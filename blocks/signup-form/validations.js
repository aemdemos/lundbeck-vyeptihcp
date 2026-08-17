import { initFormValidation } from "../../scripts/form-validator.js";
import { getFormData } from "./form-submission.js";

export async function initValidationListeners() {

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
    // let submitValidationTriggered = false;
    document.getElementById("form-submitbtn").addEventListener("click", (event) => {

//   document.addEventListener('submit',
//     (event) => {
        event.preventDefault();
        if (validator.validateForm()) {     
            console.log(" Validated");
            console.log(getFormData());
        } else {console.log("Not Validated");
            
        }
    }
  );

}