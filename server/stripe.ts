export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 0);
}

export async function getStripeInstance() {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment.");
  }
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
}

export async function createConnectAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const stripe = await getStripeInstance();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function createConnectedAccount(email: string) {
  const stripe = await getStripeInstance();
  return stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });
}

export async function createPaymentIntent(amount: number, companyStripeAccountId: string, guardStripeAccountId: string, invoiceId: string) {
  const stripe = await getStripeInstance();
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'gbp',
    transfer_data: {
      destination: guardStripeAccountId,
    },
    metadata: {
      invoiceId,
    },
  });
}
