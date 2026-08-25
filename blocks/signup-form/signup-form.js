import { getBlockId } from '../../scripts/scripts.js';
import { loadScript, loadCSS } from '../../scripts/aem.js';

/**
 * Signup Form block — "Request a rep / Register for updates" lead-capture form.
 *
 * The source renders a static HTML <form> whose behavior (conditional show/hide, State &
 * Specialty dropdowns, phone/ZIP/NPI validation, Google Places address autocomplete,
 * reCAPTCHA, and the form-encoded POST to Lundbeck's /api/registration) is wired by the
 * shared site clientlib. It is neither an iframe nor a self-registering web component, so
 * per the "load the real thing" directive this block reproduces the source form DOM and
 * loads the same vendor clientlibs so the existing site JS drives it.
 *
 * NOTE: the form's submit target (Lundbeck /api/registration), reCAPTCHA sitekey, and CSRF
 * are origin-bound to vyeptihcp.com — a real submit only succeeds on that origin. Rendering,
 * validation, and dropdown/autocomplete behavior work anywhere the clientlibs load.
 *
 * The origin the clientlibs/API are served from is authored in content (row 1) so it is not
 * hard-coded; defaults to the production HCP origin.
 */
const DEFAULT_ORIGIN = 'https://www.vyeptihcp.com';

const CLIENTLIBS = [
  '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-dependencies.min.js',
  '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-base.min.js',
  '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-site.min.js',
];
const CLIENTLIB_CSS = [
  '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-base.min.css',
  '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-site.min.css',
];

function formMarkup(origin) {
  return `
<div id="signUp" class="sign-up-outer-wrapper signupForm">
  <form class="form-container" id="signupForm" novalidate="novalidate" method="post" data-submit="${origin}/api/registration">
    <input type="hidden" name="vyeptihcp-code" id="vyeptihcp-code" value="EPT-B-100032v4"/>
    <input type="hidden" name="rtm" id="rtm" value="true"/>
    <h2>Request information about VYEPTI</h2>
    <p class="required-information">*Required field</p>
    <div class="form-group row sign-check-wrapper">
      <div class="sign-check-container">
        <h5 class="sign-check-header">To get started, tell us what you are interested in*:</h5>
        <div class="form-check">
          <ul class="req-repo">
            <li>
              <input class="form-check-input" name="reprequest" type="checkbox" value="true" id="reprequest"/>
              <label class="form-check-label" for="reprequest">Request a rep</label>
              <p class="req-repo-label">What is the nature of your inquiry? (Select all that apply)</p>
              <ul class="req-repo-nature">
                <li><input class="form-check-input" name="productInfo" type="checkbox" value="true" id="productInfo"/><label class="form-check-label" for="productInfo"><span><b>Product information/question</b></span></label></li>
                <li><input class="form-check-input" name="vyeptiConnect" type="checkbox" value="true" id="vyeptiConnect"/><label class="form-check-label" for="vyeptiConnect"><span><b>VYEPTI CONNECT (access &amp; support) question</b></span></label></li>
                <li><input class="form-check-input" name="patientResources" type="checkbox" value="true" id="patientResources"/><label class="form-check-label" for="patientResources"><span><b>Patient resources question, including financial assistance</b></span></label></li>
                <li><input class="form-check-input" name="infusionLocator" type="checkbox" value="true" id="infusionLocator"/><label class="form-check-label" for="infusionLocator"><span><b>Infusion locator/home infusion question</b></span></label></li>
                <li><input class="form-check-input" name="purchaseVyepti" type="checkbox" value="true" id="purchaseVyepti"/><label class="form-check-label" for="purchaseVyepti"><span><b>How to purchase VYEPTI</b></span></label></li>
                <li><input class="form-check-input" name="other" type="checkbox" value="true" id="other"/><label class="form-check-label" for="other"><span><b>Other</b></span></label></li>
              </ul>
            </li>
          </ul>
        </div>
        <div class="form-check">
          <input class="form-check-input" name="requestupdate" type="checkbox" value="true" id="requestupdate"/>
          <label class="form-check-label" for="requestupdate">Register for updates</label>
        </div>
      </div>
      <label id="interested-error" class="custom-error">Please select one or more options above</label>
    </div>
    <div class="form-group row">
      <div class="col"><label for="firstName" class="form-label col-form-label col">First name*</label><input autocomplete="none" type="text" name="firstName" maxlength="50" data-regex="^[a-zA-Z ‘’'-]*$" data-regex-error="Please enter a valid first name" required id="firstName" class="form-control form-text" data-error="Please enter your first name"/></div>
      <div class="col"><label for="lastName" class="form-label col-form-label col">Last name*</label><input autocomplete="none" type="text" name="lastName" maxlength="50" data-regex="^[a-zA-Z ‘’'-]*$" data-regex-error="Please enter a valid last name" required id="lastName" class="form-control form-text" data-error="Please enter your last name"/></div>
    </div>
    <div class="form-group row">
      <div class="col"><label for="email" class="form-label col-form-label col">Email address*</label><input autocomplete="none" type="text" name="email" minlength="6" maxlength="50" required id="email" class="form-control form-text" data-regex="^[a-zA-Z0-9]+([+_.-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*(\\.[a-zA-Z]{2,3})+$" data-regex-error="Please enter a valid email address" data-error="Please enter your email address"/></div>
    </div>
    <div class="form-group row">
      <div class="col"><label for="address" class="form-label col-form-label col">Address*</label><input autocomplete="none" type="text" name="address" required id="address" onFocus="geolocate()" data-gapi="${origin}/maps-places" data-error="Please enter your address" data-invalid-address-error="Please enter a valid address" class="form-control form-text" placeholder=" "/></div>
    </div>
    <div class="form-group row multi-field-group">
      <div class="col"><label for="locality" class="form-label col-form-label col">City*</label><input autocomplete="none" type="text" name="city" required id="locality" class="form-control form-text" data-error="Please enter your city"/></div>
      <div class="col speciality state-input">
        <div class="btn-group dropdown dropdown-toggle">
          <button type="button" id="administrative_area_level_1" class="btn btn-outline" data-toggle="dropdown" tabindex="-1">State*</button>
          <button type="button" class="btn btn-primary dropdown-showhide" data-toggle="dropdown"><span class="sr-only"></span></button>
          <div class="dropdown-menu">${[
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['PR', 'Puerto Rico'], ['AA', 'Armed Forces Americas'], ['AP', 'Armed Forces Pacific'], ['AE', 'Armed Forces Others'],
  ].map(([v, n]) => `<a class="dropdown-item" data-val="${v}">${n} (${v})</a>`).join('')}</div>
          <span class="dropdown-sup">State*</span>
        </div>
        <input autocomplete="none" type="text" name="state" required id="state" class="hidden-text form-control" data-error="Please select your state" tabindex="-1"/>
        <input autocomplete="none" type="hidden" name="state_label" id="state_label" class="d-none" value=""/>
      </div>
    </div>
    <div class="form-group row">
      <div class="col"><label for="postal_code" class="form-label col-form-label col">ZIP code*</label><input autocomplete="none" type="text" name="zip" id="postal_code" minlength="5" maxlength="10" class="form-control form-text" required data-error="Please enter your ZIP code" data-pattern="^[0-9]{5}(?:-[0-9]{4})?$" data-pattern-error="Please enter a valid ZIP code"/></div>
    </div>
    <div class="form-group row">
      <div class="col speciality speciality-input">
        <div class="btn-group dropdown dropdown-toggle">
          <button type="button" class="btn btn-outline" data-toggle="dropdown">What is your specialty?*</button>
          <button type="button" class="btn btn-primary dropdown-showhide" data-toggle="dropdown" tabindex="-1"><span class="sr-only"></span></button>
          <div class="dropdown-menu">${[
    ['neurology', 'Neurology'], ['headachespecialist', 'Headache Specialist'], ['painspecialist', 'Pain Specialist'], ['primarycare', 'Primary Care'], ['nursepractitioner', 'Nurse Practitioner'], ['physicianassistant', 'Physician Assistant'], ['registerednurse', 'Registered Nurse'], ['allergyimmunology', 'Allergy &amp; Immunology'], ['anesthesiology', 'Anesthesiology'], ['dentistry', 'Dentistry'], ['dermatology', 'Dermatology'], ['diagnosticradiology', 'Diagnostic Radiology'], ['emergencymedicine', 'Emergency Medicine'], ['internalmedicine', 'Internal Medicine'], ['medicalgenetics', 'Medical Genetics'], ['nuclearmedicine', 'Nuclear Medicine'], ['obstetricsgynecology', 'Obstetrics &amp; Gynecology'], ['ophthalmology', 'Ophthalmology'], ['pathology', 'Pathology'], ['physicalmedicinerehabilitation', 'Physical Medicine &amp; Rehabilitation'], ['preventativemedicine', 'Preventive Medicine'], ['psychiatry', 'Psychiatry'], ['radiationoncology', 'Radiation Oncology'], ['surgery', 'Surgery'], ['urology', 'Urology'], ['othermedicalprofessional', 'Other medical professional'],
  ].map(([v, n]) => `<a class="dropdown-item" data-val="${v}">${n}</a>`).join('')}</div>
          <span class="dropdown-sup">What is your specialty?*</span>
        </div>
        <input autocomplete="none" type="text" name="speciality" required id="speciality" class="hidden-text form-control" data-error="Please select one option" tabindex="-1"/>
        <input autocomplete="none" type="hidden" name="speciality_label" id="speciality_label" class="d-none" value=""/>
      </div>
    </div>
    <div class="form-group row">
      <div class="col"><label for="npiNumber" class="form-label col-form-label col">NPI #* <span>(to help process form faster)</span></label><input autocomplete="none" type="text" name="npiNumber" required id="npiNumber" maxlength="10" class="form-control form-text" data-error="Please enter a valid 10-digit NPI number" data-pattern="^[0-9]{10}$" data-pattern-error="Please enter a valid 10-digit NPI number"/></div>
    </div>
    <div class="form-group row">
      <div class="col"><label for="phone" class="form-label col-form-label col">Phone number</label><input autocomplete="none" type="text" name="phone" id="phone" minlength="14" maxlength="14" class="form-control input-phone-number form-text" data-pattern-error="Please enter a valid 10-digit phone number" data-error="Please enter a valid 10-digit phone number"/></div>
    </div>
    <div class="form-group row">
      <div class="col authorize">
        <input type="checkbox" name="consent" required value="true" id="consent" class="form-control form-checkbox" data-error="Please check the box to proceed"/>
        <label for="consent" id="authorizeText"><p>By checking this box, you are authorizing Lundbeck, its agents, or vendors acting on behalf of Lundbeck to send you information regarding Lundbeck and its products and services; send you additional health, medical, or patient education information; and contact you to seek your participation in other surveys or programs.</p></label>
      </div>
    </div>
    <div class="form-group row">
      <div class="captcha">
        <div class="g-recaptcha" data-sitekey="6LeC0BYUAAAAAHJanrApkgbbpp1PZDKi7oOnZjvE" data-callback="recaptchaCallback"></div>
        <input id="hidden-grecaptcha" name="hidden-grecaptcha" type="hidden"/>
      </div>
      <label id="captcha-error" class="custom-error">Please check the box to proceed</label>
    </div>
    <div class="form-group row termsAndCondition">
      <div class="col"><p>Lundbeck will not sell the data you provide to any third party, at any time. By clicking SUBMIT, you signify that you have read and agree to our <a href="https://www.lundbeck.com/us/terms-of-use" class="rte-external-link" target="_blank"><u>Terms of Use</u></a> and <a href="https://www.lundbeck.com/us/privacy-policy" class="rte-external-link" target="_blank"><u>Privacy Policy</u></a>.</p></div>
    </div>
    <div class="form-group row submit">
      <button type="submit" id="submitSignup" class="button button-primary">Submit</button>
      <label id="server-error" class="custom-error text-center">An error occurred. Please refresh your page and try again later.</label>
    </div>
  </form>
  <input type="hidden" name="sign-up-thank-you" id="sign-up-thank-you" value="${origin}/sign-up/thank-you.html"/>
</div>`;
}

export default async function decorate(block) {
  const blockId = getBlockId('signup-form');
  block.setAttribute('id', blockId);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Sign up form');

  // Row 1 (optional): origin that serves the vendor clientlibs + API. Defaults to prod HCP.
  const originCell = block.querySelector(':scope > div > div');
  const authoredOrigin = originCell && originCell.textContent.trim();
  const origin = (authoredOrigin && /^https?:\/\//.test(authoredOrigin))
    ? authoredOrigin.replace(/\/$/, '')
    : DEFAULT_ORIGIN;

  block.innerHTML = formMarkup(origin);

  // Load the vendor styles + scripts that drive the form (idempotent per URL).
  CLIENTLIB_CSS.forEach((href) => loadCSS(`${origin}${href}`));
  // reCAPTCHA API for the widget.
  loadScript('https://www.google.com/recaptcha/api.js', { async: '', defer: '' });
  // Clientlibs must load in order (dependencies → base → site); site wires #signupForm.
  /* eslint-disable no-await-in-loop */
  for (const src of CLIENTLIBS) {
    try {
      await loadScript(`${origin}${src}`);
    } catch (e) {
      // Fail securely: partial load still renders the static form + native validation.
    }
  }
  /* eslint-enable no-await-in-loop */
}
