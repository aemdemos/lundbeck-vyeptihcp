export function getFormData() {
  const stateSelect = document.getElementById('form-state');
  const specialitySelect = document.getElementById('form-speciality');

  const formData = {
    "vyeptihcp-code": "vyeptihcp",
    rtm: "rtm",

    reprequest: document.getElementById('form-requestrep')?.checked,

    productInfo: document.getElementById('form-produinfo')?.checked,
    vyeptiConnect: document.getElementById('form-vconnect')?.checked,
    patientResources: document.getElementById('form-patientresources')?.checked,
    infusionLocator: document.getElementById('form-infusionlocator')?.checked,
    purchaseVyepti: document.getElementById('form-howtopurchase')?.checked,
    other: document.getElementById('form-other')?.checked,

    requestupdate: document.getElementById('form-registerforupdates')?.checked,

    firstName: document.getElementById('form-firstname')?.value.trim(),
    lastName: document.getElementById('form-lastname')?.value.trim(),
    email: document.getElementById('form-email')?.value.trim(),
    address: document.getElementById('form-address')?.value.trim(),
    city: document.getElementById('form-city')?.value.trim(),

    state: stateSelect?.value || "",
    state_label:
      stateSelect?.options[stateSelect.selectedIndex]?.text || "",

    zip: document.getElementById('form-zipcode')?.value.trim(),

    speciality: specialitySelect?.value || "",
    speciality_label:
      specialitySelect?.options[specialitySelect.selectedIndex]?.text || "",

    npiNumber: document.getElementById('form-npi')?.value.trim(),
    phone: document.getElementById('form-phone')?.value.trim(),

    consent: document.getElementById('form-authorized')?.checked,

    "g-recaptcha-response":
      document.querySelector('[name="g-recaptcha-response"]')?.value || "",

    "hidden-grecaptcha":
      document.querySelector('[name="hidden-grecaptcha"]')?.value || ""
  };

  console.log("Form Payload:", formData);

  return formData;
}