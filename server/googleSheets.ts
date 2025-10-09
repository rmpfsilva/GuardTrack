// Referenced from blueprint:google-sheet
import { google } from 'googleapis';
import type { CheckInWithDetails } from '@shared/schema';
import { format } from 'date-fns';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// Create or get spreadsheet for check-in logs
export async function getOrCreateCheckInSpreadsheet(): Promise<string> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    // Try to find existing spreadsheet
    const drive = google.drive({ version: 'v3', auth: sheets.auth });
    const response = await drive.files.list({
      q: "name='GuardTrack Check-In Logs' and mimeType='application/vnd.google-apps.spreadsheet'",
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    // Create new spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'GuardTrack Check-In Logs',
        },
        sheets: [{
          properties: {
            title: 'Check-Ins',
          },
          data: [{
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: 'Date' } },
                { userEnteredValue: { stringValue: 'Guard Name' } },
                { userEnteredValue: { stringValue: 'Email' } },
                { userEnteredValue: { stringValue: 'Site' } },
                { userEnteredValue: { stringValue: 'Check-In Time' } },
                { userEnteredValue: { stringValue: 'Check-Out Time' } },
                { userEnteredValue: { stringValue: 'Duration (hours)' } },
                { userEnteredValue: { stringValue: 'Status' } },
              ],
            }],
          }],
        }],
      },
    });

    return createResponse.data.spreadsheetId!;
  } catch (error) {
    console.error('Error managing Google Sheets:', error);
    throw error;
  }
}

// Sync check-in data to Google Sheets
export async function syncCheckInToSheets(checkIn: CheckInWithDetails): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const spreadsheetId = await getOrCreateCheckInSpreadsheet();

    const duration = checkIn.checkOutTime 
      ? ((new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime()) / (1000 * 60 * 60)).toFixed(2)
      : 'In Progress';

    const row = [
      format(new Date(checkIn.checkInTime), 'yyyy-MM-dd'),
      `${checkIn.user.firstName || ''} ${checkIn.user.lastName || ''}`.trim() || checkIn.user.email,
      checkIn.user.email || '',
      checkIn.site.name,
      format(new Date(checkIn.checkInTime), 'HH:mm:ss'),
      checkIn.checkOutTime ? format(new Date(checkIn.checkOutTime), 'HH:mm:ss') : '',
      duration,
      checkIn.status,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Check-Ins!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log('Successfully synced check-in to Google Sheets');
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    // Don't throw - we don't want to fail the check-in if sheets sync fails
  }
}

// Update check-out time in Google Sheets
export async function updateCheckOutInSheets(checkIn: CheckInWithDetails): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const spreadsheetId = await getOrCreateCheckInSpreadsheet();

    // Find the row with this check-in (match by check-in time and guard name)
    const guardName = `${checkIn.user.firstName || ''} ${checkIn.user.lastName || ''}`.trim() || checkIn.user.email;
    const checkInTimeStr = format(new Date(checkIn.checkInTime), 'HH:mm:ss');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Check-Ins!A:H',
    });

    const rows = response.data.values || [];
    
    // Find matching row
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === guardName && rows[i][4] === checkInTimeStr && !rows[i][5]) {
        // Update this row
        const duration = checkIn.checkOutTime 
          ? ((new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime()) / (1000 * 60 * 60)).toFixed(2)
          : '0';

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Check-Ins!F${i + 1}:H${i + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              checkIn.checkOutTime ? format(new Date(checkIn.checkOutTime), 'HH:mm:ss') : '',
              duration,
              checkIn.status,
            ]],
          },
        });

        console.log('Successfully updated check-out in Google Sheets');
        return;
      }
    }
  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    // Don't throw - we don't want to fail the check-out if sheets sync fails
  }
}
