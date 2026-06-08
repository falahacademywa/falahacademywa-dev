// ============================================================
// FALAH ACADEMY — ADMISSION POPUP FORM
// ============================================================

let popupStep = 1;

// ---- OPEN / CLOSE ----
function openAdmissionPopup() {
  var popup = document.getElementById('admission-popup');
  if (popup) {
    popup.classList.add('open');
    document.body.classList.add('popup-open');
    popupStep = 1;
    showPopupStep(1);
  }
}

function closeAdmissionPopup() {
  var popup = document.getElementById('admission-popup');
  if (popup) {
    popup.classList.remove('open');
    document.body.classList.remove('popup-open');
    clearAllErrors();
  }
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', function() {
  var popup = document.getElementById('admission-popup');
  if (popup) {
    popup.addEventListener('click', function(e) {
      if (e.target === this) closeAdmissionPopup();
    });
  }
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAdmissionPopup();
});

// ---- STEP NAVIGATION ----
function showPopupStep(step) {
  var pages = document.querySelectorAll('.popup-form-page');
  pages.forEach(function(p, i) {
    p.classList.toggle('active', i + 1 === step);
  });

  for (var i = 1; i <= 4; i++) {
    var circle = document.getElementById('pstep-' + i);
    var label  = document.getElementById('plabel-' + i);
    if (!circle || !label) continue;
    circle.classList.remove('active', 'done');
    label.classList.remove('active');
    if (i < step)      circle.classList.add('done');
    else if (i === step) { circle.classList.add('active'); label.classList.add('active'); }
    var conn = document.getElementById('pconn-' + i);
    if (conn) conn.classList.toggle('done', i < step);
  }

  popupStep = step;
  var modal = document.querySelector('.popup-modal');
  if (modal) modal.scrollTop = 0;
}

function popupNext() {
  if (validatePopupStep(popupStep)) showPopupStep(popupStep + 1);
}

function popupPrev() {
  clearAllErrors();
  if (popupStep > 1) showPopupStep(popupStep - 1);
}

// ---- VALIDATION ----
function isValidUSPhone(phone) {
  var digits = phone.replace(/\D/g, '');
  if (digits.charAt(0) === '1') digits = digits.substring(1);
  return digits.length === 10;
}

function isValidEmail(email) {
  var parts = email.trim().split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1].indexOf('.') > 0;
}

function isValidName(name) {
  return name.trim().length >= 2;
}

function isValidZip(zip) {
  return /^\d{5}$/.test(zip.trim());
}

function showFieldError(fieldId, message) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.style.borderColor = '#c62828';
  var err = field.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    err.style.cssText = 'color:#c62828;font-size:11px;margin-top:4px;';
    field.parentElement.appendChild(err);
  }
  err.textContent = message;
}

function clearFieldError(fieldId) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.style.borderColor = '';
  var err = field.parentElement.querySelector('.field-error');
  if (err) err.remove();
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(function(e) { e.remove(); });
  document.querySelectorAll('.form-input, .form-select').forEach(function(f) { f.style.borderColor = ''; });
}

function validatePopupStep(step) {
  clearAllErrors();
  var valid = true;

  if (step === 1) {
    var firstName = document.getElementById('p_student_first') ? document.getElementById('p_student_first').value : '';
    var lastName  = document.getElementById('p_student_last')  ? document.getElementById('p_student_last').value  : '';
    if (!isValidName(firstName)) { showFieldError('p_student_first', 'Please enter a valid first name (at least 2 characters)'); valid = false; }
    if (!isValidName(lastName))  { showFieldError('p_student_last',  'Please enter a valid last name (at least 2 characters)');  valid = false; }

    if (!document.querySelector('input[name="p_gender"]:checked')) {
      valid = false;
      var gGroup = document.querySelector('.form-radio-group');
      if (gGroup && !gGroup.querySelector('.field-error')) {
        var err = document.createElement('p');
        err.className = 'field-error';
        err.style.cssText = 'color:#c62828;font-size:11px;margin-top:4px;';
        err.textContent = 'Please select a gender';
        gGroup.appendChild(err);
      }
    }

    var dob = document.getElementById('p_dob') ? document.getElementById('p_dob').value : '';
    if (!dob) { showFieldError('p_dob', 'Please enter date of birth'); valid = false; }

    var street  = document.getElementById('p_street')  ? document.getElementById('p_street').value  : '';
    var city    = document.getElementById('p_city')    ? document.getElementById('p_city').value    : '';
    var zipcode = document.getElementById('p_zipcode') ? document.getElementById('p_zipcode').value : '';
    if (street.trim().length < 5)  { showFieldError('p_street',  'Please enter a valid street address'); valid = false; }
    if (city.trim().length < 2)    { showFieldError('p_city',    'Please enter a valid city');           valid = false; }
    if (!isValidZip(zipcode))      { showFieldError('p_zipcode', 'Please enter a valid 5-digit ZIP code'); valid = false; }

    var grade = document.getElementById('p_grade') ? document.getElementById('p_grade').value : '';
    if (!grade) { showFieldError('p_grade', 'Please select a grade'); valid = false; }
  }

  if (step === 2) {
    var fFirst = document.getElementById('p_father_first') ? document.getElementById('p_father_first').value : '';
    var fLast  = document.getElementById('p_father_last')  ? document.getElementById('p_father_last').value  : '';
    var mFirst = document.getElementById('p_mother_first') ? document.getElementById('p_mother_first').value : '';
    var mLast  = document.getElementById('p_mother_last')  ? document.getElementById('p_mother_last').value  : '';
    if (!isValidName(fFirst)) { showFieldError('p_father_first', 'Please enter a valid name (at least 2 characters)'); valid = false; }
    if (!isValidName(fLast))  { showFieldError('p_father_last',  'Please enter a valid name (at least 2 characters)'); valid = false; }
    if (!isValidName(mFirst)) { showFieldError('p_mother_first', 'Please enter a valid name (at least 2 characters)'); valid = false; }
    if (!isValidName(mLast))  { showFieldError('p_mother_last',  'Please enter a valid name (at least 2 characters)'); valid = false; }

    var fEmail = document.getElementById('p_father_email') ? document.getElementById('p_father_email').value : '';
    if (!isValidEmail(fEmail)) { showFieldError('p_father_email', 'Please enter a valid email address'); valid = false; }

    var fPhone = document.getElementById('p_father_phone') ? document.getElementById('p_father_phone').value : '';
    var mPhone = document.getElementById('p_mother_phone') ? document.getElementById('p_mother_phone').value : '';
    if (!isValidUSPhone(fPhone)) { showFieldError('p_father_phone', 'Please enter a valid US phone number e.g. (206) 555-0123'); valid = false; }
    if (!isValidUSPhone(mPhone)) { showFieldError('p_mother_phone', 'Please enter a valid US phone number e.g. (206) 555-0123'); valid = false; }

    if (isValidUSPhone(fPhone) && isValidUSPhone(mPhone)) {
      var fD = fPhone.replace(/\D/g, ''); if (fD.charAt(0)==='1') fD=fD.substring(1);
      var mD = mPhone.replace(/\D/g, ''); if (mD.charAt(0)==='1') mD=mD.substring(1);
      if (fD === mD) { showFieldError('p_mother_phone', "Mother's phone cannot be the same as Father's phone"); valid = false; }
    }
  }

  if (step === 3) {
    var emgName  = document.getElementById('p_emg_name')  ? document.getElementById('p_emg_name').value  : '';
    var emgPhone = document.getElementById('p_emg_phone') ? document.getElementById('p_emg_phone').value : '';
    var emgRel   = document.getElementById('p_emg_rel')   ? document.getElementById('p_emg_rel').value   : '';
    if (!isValidName(emgName))    { showFieldError('p_emg_name',  'Please enter a valid name (at least 2 characters)'); valid = false; }
    if (!isValidUSPhone(emgPhone)){ showFieldError('p_emg_phone', 'Please enter a valid US phone number'); valid = false; }
    if (!emgRel)                  { showFieldError('p_emg_rel',   'Please select a relationship'); valid = false; }

    if (isValidUSPhone(emgPhone)) {
      var eD = emgPhone.replace(/\D/g,''); if (eD.charAt(0)==='1') eD=eD.substring(1);
      var fPhone2 = document.getElementById('p_father_phone') ? document.getElementById('p_father_phone').value : '';
      var mPhone2 = document.getElementById('p_mother_phone') ? document.getElementById('p_mother_phone').value : '';
      var fD2 = fPhone2.replace(/\D/g,''); if (fD2.charAt(0)==='1') fD2=fD2.substring(1);
      var mD2 = mPhone2.replace(/\D/g,''); if (mD2.charAt(0)==='1') mD2=mD2.substring(1);
      if (eD === fD2) { showFieldError('p_emg_phone', "Emergency contact phone cannot be the same as Father's phone"); valid = false; }
      else if (eD === mD2) { showFieldError('p_emg_phone', "Emergency contact phone cannot be the same as Mother's phone"); valid = false; }
    }
  }

  if (step === 4) {
    var agree = document.getElementById('p_agree');
    if (!agree || !agree.checked) {
      if (agree) {
        agree.style.outline = '2px solid #c62828';
        var fg = agree.closest('.form-group');
        if (fg && !fg.querySelector('.field-error')) {
          var err2 = document.createElement('p');
          err2.className = 'field-error';
          err2.style.cssText = 'color:#c62828;font-size:11px;margin-top:4px;';
          err2.textContent = 'Please agree to the terms to proceed';
          fg.appendChild(err2);
        }
      }
      valid = false;
    }
  }

  return valid;
}

// ---- SUBMIT ----
function submitPopupForm(e) {
  e.preventDefault();
  if (!validatePopupStep(4)) return;

  var btn = document.getElementById('popup-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  var street  = document.getElementById('p_street')  ? document.getElementById('p_street').value  : '';
  var city    = document.getElementById('p_city')    ? document.getElementById('p_city').value    : '';
  var zipcode = document.getElementById('p_zipcode') ? document.getElementById('p_zipcode').value : '';
  var fullAddr = street + ', ' + city + ', WA ' + zipcode;

  var params = {
    student_first_name:     document.getElementById('p_student_first')  ? document.getElementById('p_student_first').value  : '',
    student_middle_name:    document.getElementById('p_student_middle') ? document.getElementById('p_student_middle').value : '',
    student_last_name:      document.getElementById('p_student_last')   ? document.getElementById('p_student_last').value   : '',
    gender:                 document.querySelector('input[name="p_gender"]:checked') ? document.querySelector('input[name="p_gender"]:checked').value : '',
    date_of_birth:          document.getElementById('p_dob')            ? document.getElementById('p_dob').value            : '',
    address:                fullAddr,
    street:                 street,
    city:                   city,
    zipcode:                zipcode,
    grade:                  document.getElementById('p_grade')          ? document.getElementById('p_grade').value          : '',
    father_first_name:      document.getElementById('p_father_first')   ? document.getElementById('p_father_first').value   : '',
    father_middle_name:     document.getElementById('p_father_middle')  ? document.getElementById('p_father_middle').value  : '',
    father_last_name:       document.getElementById('p_father_last')    ? document.getElementById('p_father_last').value    : '',
    father_email:           document.getElementById('p_father_email')   ? document.getElementById('p_father_email').value   : '',
    father_phone:           document.getElementById('p_father_phone')   ? document.getElementById('p_father_phone').value   : '',
    mother_first_name:      document.getElementById('p_mother_first')   ? document.getElementById('p_mother_first').value   : '',
    mother_last_name:       document.getElementById('p_mother_last')    ? document.getElementById('p_mother_last').value    : '',
    mother_phone:           document.getElementById('p_mother_phone')   ? document.getElementById('p_mother_phone').value   : '',
    emergency_name:         document.getElementById('p_emg_name')       ? document.getElementById('p_emg_name').value       : '',
    emergency_phone:        document.getElementById('p_emg_phone')      ? document.getElementById('p_emg_phone').value      : '',
    emergency_relationship: document.getElementById('p_emg_rel')        ? document.getElementById('p_emg_rel').value        : '',
    heard_about:            document.getElementById('p_heard')          ? document.getElementById('p_heard').value          : '',
    previous_school:        document.getElementById('p_prev_school')    ? document.getElementById('p_prev_school').value    : '',
    special_needs:          document.getElementById('p_special')        ? document.getElementById('p_special').value        : '',
    comments:               document.getElementById('p_comments')       ? document.getElementById('p_comments').value       : ''
  };

  emailjs.init('gYiHBKLQSOxt1Sfal');
  emailjs.send('service_1g7cfrl', 'template_tiqzn2e', params)
    .then(function(response) {
      console.log('EmailJS SUCCESS:', response.status, response.text);
      var formEl = document.getElementById('popup-admission-form');
      var successEl = document.getElementById('popup-success');
      if (formEl) formEl.style.display = 'none';
      if (successEl) successEl.classList.add('show');
    })
    .catch(function(error) {
      console.error('EmailJS FULL ERROR:', JSON.stringify(error));
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Admission'; }
      var errorMsg = error && error.text ? error.text : (error && error.status ? 'Status: ' + error.status : 'Unknown error');
      alert('EmailJS Error: ' + errorMsg + '\n\nPlease email us directly at falahacademywa@gmail.com');
    });
}
