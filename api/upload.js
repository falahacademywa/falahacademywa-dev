// Netlify/Cloudflare Function — Google Drive Upload
// This handles file uploads from the admission form

const FOLDER_ID = '1KAKcUbj_3W7bzURBchKQRQ-zMry2XO58';
const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "falah-academy",
  "private_key_id": "9068e7468b9a6d2d4a37799dd16481f74e8e3770",
  "client_email": "falah-academy-drive@falah-academy.iam.gserviceaccount.com",
  "client_id": "105461375077412250283",
  "token_uri": "https://oauth2.googleapis.com/token"
};

module.exports = { FOLDER_ID, SERVICE_ACCOUNT };
