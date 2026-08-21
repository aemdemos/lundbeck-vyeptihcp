
export function getFormData(config) {
  const stateSelect = document.getElementById('form-state');
  const specialitySelect = document.getElementById('form-speciality');

  const formData = {
    "vyeptihcp-code": config.vyeptiHCPCode,
    rtm: true,

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

    state: stateSelect.value.match(/\(([^()]+)\)/)[1] || "",
    // eslint-disable-next-line secure-coding/detect-object-injection
    state_label: stateSelect?.options[stateSelect.selectedIndex]?.text || "",

    zip: document.getElementById('form-zipcode')?.value.trim(),

    speciality: specialitySelect.value.toLowerCase().replaceAll(" ", "") || "",
    // eslint-disable-next-line secure-coding/detect-object-injection
    speciality_label: specialitySelect?.options[specialitySelect.selectedIndex]?.text || "",

    npiNumber: document.getElementById('form-npi')?.value.trim(),
    phone: document.getElementById('form-phone')?.value.trim(),
    consent: document.getElementById('form-authorized')?.checked,
    "g-recaptcha-response": document.querySelector('[name="g-recaptcha-response"]')?.value || "",
    "hidden-grecaptcha": document.querySelector('[name="hidden-grecaptcha"]')?.value || ""
  };

  // console.log("Form Payload:", formData);

  return formData;
}

export const showError = (el, msg) => {
  let err = el.parentNode.querySelector('.form-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'form-error text-error';
    err.style.display = 'block';
    el.after(err);
  }
  err.textContent = msg;
};

export async function submitForm(formData,config){
  let apiBody = new URLSearchParams();
  Object.entries(formData).forEach(([key, value]) => {
    apiBody.append(key, value);
  });
  apiBody=apiBody.toString();

  // Send the POST request
  const response = await fetch(config.apiEndPoint, {
      method: 'POST',
      body: apiBody 
  });

  if (!response.ok) {
      throw new Error(`HTTP Resuest error! Status: ${response.status}`);
  }

  // Parse the server response
  const result = await response.json();
  if (result.validNpi === false) {
    // console.error("INVALID_NPI");
    const input = document.querySelector('#form-npi');
    showError(input, 'Please enter a valid 10 digit NPI number');
    input.scrollIntoView();
    Array.from(input.parentElement.children)
    .find(child => child !== input && child.classList.contains('form-error')).style.display="";
  }else{
      // console.log('Success:', result);
      window.location.href = config.thankYouPageUrl;          
  }
 
}