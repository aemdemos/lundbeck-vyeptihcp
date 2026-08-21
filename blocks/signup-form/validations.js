import { initFormValidation } from "../../scripts/form-validator.js";
import { getFormData, submitForm } from "./form-submission.js";

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

const hideError = (el) => el.parentNode.querySelector('.form-error')?.remove();

function isAtLeastOneChecked(id1, id2) {
  const checkbox1 = document.getElementById(id1);
  const checkbox2 = document.getElementById(id2);
  const response = (checkbox1?.checked || checkbox2?.checked) ?? false;
  const input = document.querySelector('#form-registerforupdates');
  if(response){
    hideError(input);
  }else{
    showError(input, 'Please select one or more options above');
  }
  return response;
}

function isCaptchaCleared(){
    // eslint-disable-next-line no-undef
    const validResponse=grecaptcha.getResponse().length !== 0;
    const input = document.querySelector('#g-recaptcha div');
    if(validResponse){ hideError(input);  }else{
        showError(input, 'Please check the box to proceed')
    }
    return validResponse;
}


export async function initValidationListeners(config) {

    const validator = await initFormValidation(".signup-form form", {
        showRequiredMessagesOnSubmitnly: true,
  
        error: {
            element: "div",
            className: "form-error"
        },
        rules: {
            firstName: {
                required: {
                    value: true,
                    message: "Please enter your first name"
                }
            },

            lastName: {
                required: {
                    value: true,
                    message: "Please enter your last name"
                }
            },

            email: {
                required: {
                    value: true,
                    message: "Please enter your email address"
                },
                emailformat: {
                    value: true,
                    message: "Please enter a valid email address"
                }
            },

            address: {
                required: {
                    value: true,
                    message: "Please enter your address"
                }
            },

            city: {
                required: {
                    value: true,
                    message: "Please enter your city"
                }
            },

            state: {
                required: {
                    value: true,
                    message: "Please enter your state"
                }
            },

            zipCode: {
                required: {
                    value: true,
                    message: "Please enter your zip code"
                }
            },

            speciality: {
                required: {
                    value: true,
                    message: "Please select your one Option"
                }
            },

            npi: {
                required: {
                    value: true,
                    message: "Please enter a valid 10-digit NPI number"
                }
            },

            authorized: {
                required: {
                    value: true,
                    message: "Please check the box to proceed"
                }
            },

        }

    });
    document.getElementById("form-submitbtn").addEventListener("click", (event) => {
        event.preventDefault();
        const formVlidated=validator.validateForm();
        const captchaCleared=isCaptchaCleared();
        const checkboxChedked=isAtLeastOneChecked("form-requestrep","form-registerforupdates");
        if ( formVlidated && captchaCleared  && checkboxChedked ) {     
            const formData=getFormData(config)
            submitForm(formData,config);
        } else {
            // console.log("Not Validated");
        }
    }
  );

}