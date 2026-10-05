// ============================================================
// FALAH ACADEMY — VOLUNTEER APPLICATION FORM (volunteer.html)
// Submits straight to the Family Portal database (volunteer_applications,
// insert-only policy for the publishable key). The office is alerted in the
// portal and by e-mail; nothing else is sent from the browser.
// ============================================================

var PLATFORM_URL = 'https://rlaqpzeqmmlrdeqfbjyq.supabase.co';
var PLATFORM_KEY = 'sb_publishable_pFmJCkvttv7J3JUsLGdD1g_UgXwCzyy';

function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function checkedValues(name) {
  return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (el) { return el.value; });
}
function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
function isValidEmail(email) { var p = email.split('@'); return p.length === 2 && p[0].length > 0 && p[1].indexOf('.') > 0; }
function isValidUSPhone(phone) { var d = phone.replace(/\D/g, ''); if (d.charAt(0) === '1') d = d.substring(1); return d.length === 10; }

function fieldError(id, message) {
  var field = document.getElementById(id);
  if (!field) return;
  field.style.borderColor = '#c62828';
  var err = field.parentElement.querySelector('.field-error');
  if (!err) { err = document.createElement('p'); err.className = 'field-error'; err.style.cssText = 'color:#c62828;font-size:11px;margin-top:4px;'; field.parentElement.appendChild(err); }
  err.textContent = message;
}
function groupError(id, message) {
  var g = document.getElementById(id);
  if (!g || g.querySelector('.field-error')) return;
  var err = document.createElement('p'); err.className = 'field-error'; err.style.cssText = 'color:#c62828;font-size:11px;margin-top:4px;'; err.textContent = message; g.appendChild(err);
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(function (f) { f.style.borderColor = ''; });
}

function ageOn(dobStr) {
  if (!dobStr) return null;
  var dob = new Date(dobStr + 'T00:00:00'); var now = new Date();
  var a = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) a--;
  return a;
}

// show the parent/guardian block only for applicants under 18
window.volunteerDobChanged = function () {
  var age = ageOn(v('v_dob'));
  var block = document.getElementById('v_guardian_block');
  if (block) block.style.display = age !== null && age < 18 ? 'block' : 'none';
};

window.toggleDisclosureExplain = function () {
  var any = radio('v_disc_convicted') === 'yes' || radio('v_disc_abuse') === 'yes' || radio('v_disc_registry') === 'yes';
  var wrap = document.getElementById('v_disc_explain_wrap');
  if (wrap) wrap.style.display = any ? 'block' : 'none';
};

function validate() {
  clearErrors();
  var ok = true;
  if (v('v_name').length < 3) { fieldError('v_name', 'Please enter your full name'); ok = false; }
  if (!isValidEmail(v('v_email'))) { fieldError('v_email', 'Please enter a valid e-mail address'); ok = false; }
  if (!isValidUSPhone(v('v_phone'))) { fieldError('v_phone', 'Please enter a valid US phone, e.g. (206) 555-0123'); ok = false; }
  if (v('v_city').length < 2) { fieldError('v_city', 'Please enter your city'); ok = false; }
  if (!v('v_dob')) { fieldError('v_dob', 'Please enter your date of birth'); ok = false; }
  var age = ageOn(v('v_dob'));
  if (age !== null && age < 16) { fieldError('v_dob', 'Volunteers must be at least 16'); ok = false; }
  if (age !== null && age < 18) {
    if (v('v_guardian_name').length < 3) { fieldError('v_guardian_name', 'A parent or guardian name is required for applicants under 18'); ok = false; }
    if (!isValidUSPhone(v('v_guardian_phone'))) { fieldError('v_guardian_phone', 'Please enter the parent or guardian phone'); ok = false; }
  }
  if (!checkedValues('v_avail').length) { groupError('v_avail_group', 'Tick at least one block you could usually offer'); ok = false; }
  if (!checkedValues('v_interest').length) { groupError('v_interest_group', 'Tick at least one area'); ok = false; }
  if (v('v_experience').length < 10) { fieldError('v_experience', 'A sentence or two about your experience, please'); ok = false; }
  [1, 2].forEach(function (n) {
    if (v('v_ref' + n + '_name').length < 3) { fieldError('v_ref' + n + '_name', 'Reference name'); ok = false; }
    if (!isValidUSPhone(v('v_ref' + n + '_phone')) && !isValidEmail(v('v_ref' + n + '_email'))) { fieldError('v_ref' + n + '_phone', 'A phone number or e-mail for this reference'); ok = false; }
  });
  ['v_disc_convicted', 'v_disc_abuse', 'v_disc_registry'].forEach(function (name) {
    if (!radio(name)) { groupError(name + '_group', 'Please answer yes or no'); ok = false; }
  });
  var consent = document.getElementById('v_consent');
  if (!consent || !consent.checked) { groupError('v_consent_group', 'Please confirm the statement above to continue'); ok = false; }
  if (v('v_website')) ok = false; // honeypot: bots fill the hidden field
  if (!ok) {
    var first = document.querySelector('.field-error');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function buildPayload() {
  var avail = {}; ['mon', 'tue', 'wed', 'thu'].forEach(function (d) { avail[d] = []; });
  checkedValues('v_avail').forEach(function (val) {
    if (val === 'events') { avail.events = true; return; }
    var parts = val.split('_'); if (avail[parts[0]]) avail[parts[0]].push(parts[1]);
  });
  var age = ageOn(v('v_dob'));
  return {
    full_name: v('v_name'),
    preferred_name: v('v_pref') || null,
    email: v('v_email').toLowerCase(),
    phone: v('v_phone'),
    address: v('v_street') || null,
    city: v('v_city'),
    state: 'WA',
    zip: v('v_zip') || null,
    date_of_birth: v('v_dob') || null,
    under_18: age !== null && age < 18,
    guardian_name: age !== null && age < 18 ? v('v_guardian_name') : null,
    guardian_phone: age !== null && age < 18 ? v('v_guardian_phone') : null,
    availability: avail,
    start_date: v('v_start') || null,
    hours_per_week: v('v_hours') || null,
    interests: checkedValues('v_interest'),
    experience: v('v_experience'),
    languages: v('v_languages') || null,
    first_aid: v('v_firstaid') === '' ? null : v('v_firstaid') === 'yes',
    prior_volunteering: v('v_prior') || null,
    references_info: [1, 2].map(function (n) {
      return { name: v('v_ref' + n + '_name'), relationship: v('v_ref' + n + '_rel'), phone: v('v_ref' + n + '_phone'), email: v('v_ref' + n + '_email') };
    }),
    disclosures: {
      convicted: radio('v_disc_convicted') === 'yes',
      abuse_finding: radio('v_disc_abuse') === 'yes',
      registry: radio('v_disc_registry') === 'yes',
      explanation: v('v_disc_explain') || null
    },
    consent: true,
    source: 'website',
    status: 'new'
  };
}

window.submitVolunteerForm = function (e) {
  e.preventDefault();
  if (!validate()) return;
  var btn = document.getElementById('volunteer-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  fetch(PLATFORM_URL + '/rest/v1/volunteer_applications', {
    method: 'POST',
    headers: { 'apikey': PLATFORM_KEY, 'Authorization': 'Bearer ' + PLATFORM_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(buildPayload())
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
    var formEl = document.getElementById('volunteer-form-el');
    var successEl = document.getElementById('volunteer-success');
    if (formEl) formEl.style.display = 'none';
    if (successEl) { successEl.classList.add('show'); successEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }).catch(function (err) {
    console.error('Volunteer form error:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Application →'; }
    alert('Something went wrong. Please try again, or e-mail us at falahacademywa@gmail.com');
  });
};
