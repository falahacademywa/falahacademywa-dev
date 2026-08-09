/**
 * FALAH ACADEMY — Attendance sync (Google Sheets -> Platform database)
 * Implements FR-003 / BR-020: teachers keep marking attendance in Sheets;
 * this script pushes changes into the platform automatically.
 *
 * SETUP (once, ~5 min, in the school's Google account):
 * 1. Open the attendance spreadsheet > Extensions > Apps Script, paste this file.
 * 2. Project Settings > Script properties, add:
 *      SUPABASE_URL          e.g. https://xxxx.supabase.co
 *      SUPABASE_SERVICE_KEY  the service_role key (NEVER put this in the website)
 * 3. Triggers > Add trigger: syncAttendance, event source "From spreadsheet",
 *    event type "On change". Optionally also a time-driven trigger (hourly).
 *
 * EXPECTED SHEET LAYOUT (one tab per grade, named exactly like the grade,
 * e.g. "Pre-K", "KG", "Grade 1", "Grade 3"):
 *   Row 1:  StudentNo | Student Name | 2026-09-01 | 2026-09-02 | ...
 *   Rows 2+: 10001    | Ahmed T.     | P          | L          | ...
 * Cell values: P = present, L = late, A = absent (case-insensitive).
 * Blank = not recorded (nothing synced).
 */

var STATUS_MAP = { P: "present", L: "late", A: "absent" };

function syncAttendance() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SUPABASE_URL");
  var key = props.getProperty("SUPABASE_SERVICE_KEY");
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Script properties.");

  var enrollments = fetchEnrollmentMap_(url, key); // student_no -> enrollment_id
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var rows = [];

  sheets.forEach(function (sheet) {
    var data = sheet.getDataRange().getValues();
    if (data.length < 2 || data[0].length < 3) return;
    var header = data[0];
    for (var r = 1; r < data.length; r++) {
      var studentNo = String(data[r][0]).trim();
      var enrollmentId = enrollments[studentNo];
      if (!enrollmentId) continue;
      for (var c = 2; c < header.length; c++) {
        var date = normalizeDate_(header[c]);
        var status = STATUS_MAP[String(data[r][c]).trim().toUpperCase()];
        if (!date || !status) continue;
        rows.push({
          enrollment_id: enrollmentId,
          date: date,
          status: status,
          recorded_by: sheet.getName(),
          synced_at: new Date().toISOString(),
        });
      }
    }
  });

  // Upsert in batches on (enrollment_id, date)
  for (var i = 0; i < rows.length; i += 500) {
    var batch = rows.slice(i, i + 500);
    var resp = UrlFetchApp.fetch(url + "/rest/v1/attendance?on_conflict=enrollment_id,date", {
      method: "post",
      contentType: "application/json",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Prefer: "resolution=merge-duplicates",
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() >= 300) {
      throw new Error("Sync failed: " + resp.getContentText().slice(0, 300));
    }
  }
  Logger.log("Synced " + rows.length + " attendance cells.");
}

/** Map student_no -> enrollment_id for the current school year. */
function fetchEnrollmentMap_(url, key) {
  var resp = UrlFetchApp.fetch(
    url + "/rest/v1/enrollments?select=id,status,students(student_no)&status=eq.active",
    { headers: { apikey: key, Authorization: "Bearer " + key } }
  );
  var map = {};
  JSON.parse(resp.getContentText()).forEach(function (e) {
    if (e.students && e.students.student_no != null) map[String(e.students.student_no)] = e.id;
  });
  return map;
}

function normalizeDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, "America/Los_Angeles", "yyyy-MM-dd");
  }
  var s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
