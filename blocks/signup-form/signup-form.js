import { initValidationListeners } from "./validations.js";

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

function fixMarkdownText() {
  // Fix Markdown Links
  document.querySelectorAll('.plaintext-wrapper p').forEach(el => {
    const text = el.textContent;

    const fragment = document.createDocumentFragment();

    let pos = 0;

    while (pos < text.length) {
      const openBracket = text.indexOf('[', pos);
      const closeBracket = text.indexOf(']', openBracket);
      const openParen = text.indexOf('(', closeBracket);
      const closeParen = text.indexOf(')', openParen);

      const isLink =
        openBracket !== -1 &&
        closeBracket !== -1 &&
        openParen === closeBracket + 1 &&
        closeParen !== -1;

      if (!isLink) {
        fragment.appendChild(
          document.createTextNode(text.slice(pos))
        );
        break;
      }

      // Plain text before the link
      fragment.appendChild(
        document.createTextNode(text.slice(pos, openBracket))
      );

      const linkText = text.slice(openBracket + 1, closeBracket);
      const url = text.slice(openParen + 1, closeParen);

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = linkText;

      fragment.appendChild(a);

      pos = closeParen + 1;
    }

    el.replaceChildren(fragment);
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

  const labelSpan = document.createElement('span');
  labelSpan.className = 'sign-up-label-text';
  labelSpan.textContent = labelText.trim();

  const helperSpan = document.createElement('span');
  helperSpan.className = 'sign-up-label-helper';
  helperSpan.textContent = helperText.trim();

  label.replaceChildren(labelSpan, helperSpan);
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

    /* global google */
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
            // console.warn("Invalid address selected");
            return;
        }

        // console.log("Selected address:", place.formatted_address);
        // console.log("Place details:", place);

        input.dataset.selectedAddress = place.formatted_address;
    });
}



function selectLabel(id){
  const specialtySelect = document.getElementById(id);
  const specialtyLabel = document.getElementById(`${id}-label`);

  specialtySelect.addEventListener('change', function handleChange() {
    if (this.value !== "") {
      specialtyLabel.style.visibility = 'visible';
    }
  });
} 


export default async function decorate(block) {

  buildConfig(block);

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
}