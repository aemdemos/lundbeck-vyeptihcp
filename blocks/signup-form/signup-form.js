// asdafsfdsdeslint-disable-next-line import/no-cycle
import { initValidationListeners } from "./validations.js";
// import { config } from "./config.js";

 const config={};

function buildConfig(block) {
  config.vyeptiHCPCode=[...block.children][2].children[1].children[0].textContent;
  config.googleMapKey=[...block.children][3].children[1].children[0].textContent;
  config.apiEndPoint= [...block.children][1].children[1].children[0].textContent; 
  config.thankYouPageUrl= [...block.children][4].children[1].children[0].textContent; 
}


function initializeRequestRepToggle() {
  const requestRep = document.getElementById('form-requestrep');

  if (!requestRep) return;

  const inquiryIds = [
    'form-produinfo',
    'form-vconnect',
    'form-patientresources',
    'form-infusionlocator',
    'form-howtopurchase',
    'form-other'
  ];

  const inquiryElements = inquiryIds
    .map(id => document.getElementById(id)?.closest('.sign-up-checkbox'))
    .filter(Boolean);

function toggleInquiryOptions() {
  const show = requestRep.checked;

  const heading = document.getElementById('form-natureofinquiry')?.closest('.field-wrapper');

  if (heading) {
    heading.style.display = show ? 'block' : 'none';
  }

  inquiryElements.forEach(el => {
    el.style.display = show ? 'flex' : 'none';
  });
}

  toggleInquiryOptions();
  requestRep.addEventListener('change', toggleInquiryOptions);
}


function mdToHtml(str) {
  const d = document.createElement('div');
  const parts = str.split(']');
  
  return parts.map((p, i) => {
    const b = p.split('[');
    if (b.length < 2 || i === parts.length - 1) return p;
    
    const [text, url] = [b.pop(), parts[i + 1].split(')')[0].slice(1)];
    Object.assign(d.appendChild(document.createElement('a')), { href: url, textContent: text });
    
    parts[i + 1] = parts[i + 1].split(')').slice(1).join(')');
    return b.join('[') + d.innerHTML;
  }).join('');
}


function fixMarkdownText() {
  // Fix Markdown Links
  document.querySelectorAll('.plaintext-wrapper p').forEach(el => {
    el.innerHTML = mdToHtml(el.innerHTML);
  });


  // Fix Markdown Label
  document.querySelectorAll('.field-wrapper label').forEach((label) => {
    if (label.dataset.labelEnhanced === 'true') {
      return;
    }

    if (!label.textContent.includes('|')) {
      return;
    }

    label.dataset.labelEnhanced = 'true';
    const [labelText, helperText] = label.textContent.split('|');
    // eslint-disable-next-line browser-security/no-innerhtml
    label.innerHTML = `<span class="sign-up-label-text"> ${labelText}  </span><span class="sign-up-label-helper"> &nbsp;${helperText} </span>`;
  });

}

// Fuction to load the js files necessary
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', resolve);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;

    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function renderCaptcha(){
  document.getElementById('form-captcha-placeholder').remove();
  const captchaTarget = document.getElementsByClassName('g-recaptcha')[0];
  captchaTarget.id='g-recaptcha';
  if (captchaTarget.dataset.fieldset) {
    captchaTarget.dataset.sitekey = captchaTarget.dataset.fieldset;
    delete captchaTarget.dataset.fieldset;
  }
  await loadScript("https://www.google.com/recaptcha/api.js");
}

async function autoPopulateAddress() {
  await loadScript(`https://maps.googleapis.com/maps/api/js?key=${config.googleMapKey}=&libraries=places`);

  const input = document.getElementById("form-address");
    if (!input || !window.google?.maps?.places) {
        return;
    }

    // eslint-disable-next-line no-undef
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ["address"],
        fields: [
            "formatted_address",
            "address_components",
            "geometry"
        ]
    });

    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();

        if (!place.geometry) {
            console.warn("Invalid address selected");
            return;
        }

        console.log("Selected address:", place.formatted_address);
        console.log("Place details:", place);

        // Save selected place object if needed
        input.dataset.selectedAddress = place.formatted_address;
    });
}



function selectLabel(id){
  const specialtySelect = document.getElementById(id);
  const specialtyLabel = document.getElementById(`${id}-label`);

  specialtySelect.addEventListener('change', function() {
    if (this.value !== "") {
      specialtyLabel.style.visibility = 'visible';
    }
  });
} 


export default async function decorate(block) {

  buildConfig(block);
  
  try {
    const module = await import("../form/form.js");
    if (typeof module.default === 'function') {
      await module.default(block);
      selectLabel("form-speciality");
      selectLabel("form-state");
      fixMarkdownText();
      renderCaptcha();
      autoPopulateAddress();
      initializeRequestRepToggle();
      initValidationListeners(config);
      
    }
  } catch (error) {
    console.error('Failed to load form block:',error);
  }
  
}