import { initValidationListeners } from "./validations.js";


export default async function decorate(block) {

  const vyeptiHCPCode=[...block.children][2].children[1].children[0].textContent;
  
  try {
    const module = await import("../form/form.js");
    if (typeof module.default === 'function') {
      await module.default(block);
      fixMarkdownText();
      // const captchaKey=
      renderCaptcha();
      autoPopulateAddress();

      initializeRequestRepToggle();
      initValidationListeners();
      
    }
  } catch (error) {
    console.error('Failed to load form block:',error);
  }
  
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

  const heading = document
    .getElementById('form-natureofinquiry')
    ?.closest('.field-wrapper');

  if (heading) {
    heading.style.display = show ? 'block' : 'none';
  }

  inquiryElements.forEach(el => {
    el.style.display = show ? 'flex' : 'none';
  });
}

  // Hide on initial load
  toggleInquiryOptions();

  // Toggle on checkbox change
  requestRep.addEventListener('change', toggleInquiryOptions);
}

// // Handle dynamically rendered forms
// const interval = setInterval(() => {
//   const requestRep = document.getElementById('form-requestrep');

//   if (requestRep) {
//     clearInterval(interval);
//     initializeRequestRepToggle();
//   }
// }, 300);


function fixMarkdownText() {

  // document.querySelectorAll('input[required]').forEach(el => el.placeholder += '*');

  //Fix Markdown Links
  document.querySelectorAll('.plaintext-wrapper p').forEach(el => {
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    if (regex.test(el.innerHTML)) {
      el.innerHTML = el.innerHTML.replace(regex, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }
  });

  //Fix Markdown Label
  document.querySelectorAll('.field-wrapper label').forEach((label) => {
    if (label.dataset.labelEnhanced === 'true') {
      return;
    }

    if (!label.textContent.includes('|')) {
      return;
    }

    label.dataset.labelEnhanced = 'true';
    const [labelText, helperText] = label.textContent.split('|');
    label.innerHTML = `<span class="ugc-label-text"> ${labelText}  </span><span class="ugc-label-helper"> &nbsp;${helperText} </span>`;
  });

  //Fix Bold Text
  document.querySelectorAll('.plaintext-wrapper p').forEach((el) => {
    el.innerHTML = el.innerHTML.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>',
    );
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
  var captchaTarget = document.getElementsByClassName('g-recaptcha')[0];
    if (captchaTarget.dataset.fieldset) {
    captchaTarget.dataset.sitekey = captchaTarget.dataset.fieldset;
    delete captchaTarget.dataset.fieldset;
  }
  await loadScript("https://www.google.com/recaptcha/api.js");
}

async function autoPopulateAddress() {
//   const input = document.querySelector("#form-address");

// if (input) {
//     input.id = "address";
//     input.name = "address";
//     input.autocomplete = "off";
//     // input.placeholder = " ";

//     // input.setAttribute("onfocus", "geolocate()");
//     // input.addEventListener("focus", geolocate);

//     // input.setAttribute(
//     //     "data-gapi",
//     //     "https://maps.googleapis.com/maps/api/js"
//     // );
//     input.setAttribute(
//         "data-error",
//         "Please enter your address"
//     );
//     input.setAttribute(
//         "data-invalid-address-error",
//         "Please enter a valid address"
//     );

//     input.setAttribute(
//         "island_form_infra_autocomplete",
//         "none"
//     );

//     input.setAttribute(
//         "island_field_signature",
//         "text|address|address|none||parsed|0|visible"
//     );

//     input.setAttribute(
//         "aria-invalid",
//         "false"
//     );

//     input.className =
//         "form-control form-text pac-target-input valid";
// }

  await loadScript("https://maps.googleapis.com/maps/api/js?key=&libraries=places");
  initAddressAutocomplete();
}

function initAddressAutocomplete() {
  // alert("hereh");
    const input = document.getElementById("form-address");
    if (!input || !window.google?.maps?.places) {
        return;
    }

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
alert("input");
}