import { XeroClient } from 'xero-node';

const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access';

export function isXeroConfigured(): boolean {
  return !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

function getRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/xero/callback`;
}

export function createXeroClient(baseUrl: string): XeroClient {
  if (!isXeroConfigured()) {
    throw new Error("Xero is not configured. Please add XERO_CLIENT_ID and XERO_CLIENT_SECRET.");
  }
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [getRedirectUri(baseUrl)],
    scopes: XERO_SCOPES.split(' '),
  });
}

export async function buildConsentUrl(baseUrl: string): Promise<string> {
  const xero = createXeroClient(baseUrl);
  return xero.buildConsentUrl();
}

export async function handleCallback(baseUrl: string, callbackUrl: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId: string;
  tenantName: string;
}> {
  const xero = createXeroClient(baseUrl);
  const tokenSet = await xero.apiCallback(callbackUrl);

  await xero.updateTenants();
  const tenants = xero.tenants;
  if (!tenants || tenants.length === 0) {
    throw new Error("No Xero organisation found. Please connect to at least one organisation.");
  }

  const tenant = tenants[0];
  const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000);

  return {
    accessToken: tokenSet.access_token!,
    refreshToken: tokenSet.refresh_token!,
    expiresAt,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || 'Unknown',
  };
}

export async function refreshTokenIfNeeded(
  baseUrl: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} | null> {
  const now = new Date();
  const bufferMs = 60 * 1000;
  if (now.getTime() < expiresAt.getTime() - bufferMs) {
    return null;
  }

  const xero = createXeroClient(baseUrl);
  xero.setTokenSet({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_at: Math.floor(expiresAt.getTime() / 1000),
  } as any);

  const newTokenSet = await xero.refreshWithRefreshToken(
    process.env.XERO_CLIENT_ID!,
    process.env.XERO_CLIENT_SECRET!,
    refreshToken
  );

  const newExpiresAt = new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000);

  return {
    accessToken: newTokenSet.access_token!,
    refreshToken: newTokenSet.refresh_token!,
    expiresAt: newExpiresAt,
  };
}

interface XeroBillLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
}

export async function createBillInXero(
  baseUrl: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  tenantId: string,
  contactName: string,
  invoiceNumber: string,
  lineItems: XeroBillLineItem[],
  date: string,
  dueDate: string
): Promise<{
  xeroInvoiceId: string;
  newTokens?: { accessToken: string; refreshToken: string; expiresAt: Date };
}> {
  let currentAccessToken = accessToken;
  let newTokens: { accessToken: string; refreshToken: string; expiresAt: Date } | undefined;

  const refreshed = await refreshTokenIfNeeded(baseUrl, accessToken, refreshToken, expiresAt);
  if (refreshed) {
    currentAccessToken = refreshed.accessToken;
    newTokens = refreshed;
  }

  const xero = createXeroClient(baseUrl);
  xero.setTokenSet({
    access_token: currentAccessToken,
    refresh_token: refreshed?.refreshToken || refreshToken,
    token_type: 'Bearer',
    expires_at: Math.floor((refreshed?.expiresAt || expiresAt).getTime() / 1000),
  } as any);

  const contactResponse = await xero.accountingApi.getContacts(tenantId, undefined, `Name=="${contactName}"`);
  let contactId: string;

  if (contactResponse.body.contacts && contactResponse.body.contacts.length > 0) {
    contactId = contactResponse.body.contacts[0].contactID!;
  } else {
    const newContact = await xero.accountingApi.createContacts(tenantId, {
      contacts: [{ name: contactName }],
    });
    contactId = newContact.body.contacts![0].contactID!;
  }

  const bill = {
    invoices: [{
      type: 'ACCPAY' as any,
      contact: { contactID: contactId },
      date: date,
      dueDate: dueDate,
      reference: invoiceNumber,
      lineAmountTypes: 'NoTax' as any,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        accountCode: item.accountCode,
      })),
      status: 'DRAFT' as any,
    }],
  };

  const response = await xero.accountingApi.createInvoices(tenantId, bill);
  const xeroInvoiceId = response.body.invoices![0].invoiceID!;

  return { xeroInvoiceId, newTokens };
}
