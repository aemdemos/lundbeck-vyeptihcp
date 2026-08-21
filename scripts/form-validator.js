export async function waitForElement(selector) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);

        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const elements = document.querySelector(selector);
            if (elements) {
                observer.disconnect();
                resolve(elements);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function getErrorElement(field, config) {
    if (field.validationErrorElement) {
        return field.validationErrorElement;
    }

    const errorElement = document.createElement(config.element || "div");

    errorElement.className = config.className;
    errorElement.classList.add(`${field.type}-error`);
    errorElement.style.display = "none";

    const isCheckboxOrRadio = field.type === "checkbox" || field.type === "radio";
    const isSelect = field.type === "select";
    const isFile = field.type === "file";

    if (isCheckboxOrRadio || isFile) {
        const wrapper = field.closest(".field-wrapper") || field.parentElement;
        if (wrapper) {
            wrapper.insertAdjacentElement("afterend", errorElement);
        } else {
            field.insertAdjacentElement("afterend", errorElement);
        }
    } else if(isSelect){
        field.insertAdjacentElement("afterend", field);
    } else {
        field.insertAdjacentElement("afterend", errorElement);
    }

    field.validationErrorElement = errorElement;

    return errorElement;
}

function showError(field, message, errorConfig) {
    const errorElement = getErrorElement(field, errorConfig);
    errorElement.textContent = message;
    errorElement.style.display = "block";
    field.classList.add("fv-error");

    // Highlight upload preview box
    if (field.type === "file") {
        const previewContainer = field.closest(".ugc-upload-row")?.querySelector(".ugc-preview-container");
        if (previewContainer) {
            previewContainer.classList.add("fv-file-error");
        }
    }
}

function clearError(field, errorConfig) {
    const errorElement = getErrorElement(field, errorConfig);
    errorElement.textContent = "";
    errorElement.style.display = "none";
    field.classList.remove("fv-error");
    // Remove upload preview box highlight
    if (field.type === "file") {
        const previewContainer = field.closest(".ugc-upload-row")?.querySelector(".ugc-preview-container");
        if (previewContainer) {
            previewContainer.classList.remove("fv-file-error");
        }
    }
}

function getFiles(selector) {
    const files = [];

    document.querySelectorAll(selector).forEach((input) => {
        if (input.files?.length) {
            files.push(...input.files);
        }
    });

    return files;
}

function validateRule(ruleName, ruleValue, field, value, ruleConfig) {
    switch (ruleName) {
        case "required":
            if (field?.type === "file" || ruleConfig.selector) {
                const files = getFiles(ruleConfig.selector);
                return {
                    valid: files.length > 0,
                    message: "This field is required."
                };
            }

            return {
                // eslint-disable-next-line secure-coding/no-insecure-comparison
                valid: value !== "" && value !== null && value !== undefined && value !== false,
                message: "This field is required."
            };

        case "emailformat":
            return {
                // eslint-disable-next-line sonarjs/super-linear-regex, secure-coding/no-redos-vulnerable-regex
                valid: !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
                message: "Invalid email address."
            };

        case "maxLength":
            return {
                valid: value.length <= ruleValue,
                message: `Error: Write your story is too long: ${value.length}/${ruleValue}`
            };

        case "minFiles": {
            const files = getFiles(ruleConfig.selector);

            return {
                valid: files.length >= ruleValue,
                message: `Minimum ${ruleValue} file required.`
            };
        }

        case "maxFiles": {
            const files = getFiles(ruleConfig.selector);
            return {
                valid: files.length <= ruleValue,
                message: `Maximum ${ruleValue} files allowed.`
            };
        }

        case "fileSize": {
            const files = getFiles(ruleConfig.selector);
            // eslint-disable-next-line consistent-return
            files.forEach(file => {
                if (file.size > ruleValue) {
                    return {
                        valid: false,
                        message: "File size exceeds allowed limit."
                    };
                }
            });
            return { valid: true };
        }

        case "fileTypes": {
            const files = getFiles(ruleConfig.selector);
            // eslint-disable-next-line consistent-return
            files.forEach(file => {
                const ext = file.name.split(".").pop().toLowerCase();
                if (!ruleValue.includes(ext)) {
                    return {
                        valid: false,
                        message: "Invalid file type."
                    };
                }
            });
            return { valid: true };
        }

        default:
            return { valid: true };
    }
}

export async function initFormValidation(formSelector,config) {
    await waitForElement(formSelector);
    const form = document.querySelector(formSelector);
    const errorConfig = config.error || {
        element: "div",
        className: "form-error"
    };

    const validateField = (fieldName,showRequiredErrors = true) => {
        // eslint-disable-next-line secure-coding/detect-object-injection
        const ruleConfig = config.rules[fieldName];
        let field;

        if (ruleConfig.selector) {
            field = document.querySelector(ruleConfig.selector);
        } else {
            field = form.querySelector(`[name="${fieldName}"]`);
        }

        if (!field) {
            return true;
        }

        clearError(field, errorConfig);

        const value = field.type === "checkbox" ? field.checked : field.value?.trim?.() || "";

        const hasValidationError = Object.entries(ruleConfig).some(([ruleName, rule]) => {
            if (
                ruleName === "selector" ||
                !rule ||
                typeof rule !== "object" ||
                !("value" in rule)
            ) {
                return false;
            }

            const result = validateRule(
                ruleName,
                rule.value,
                field,
                value,
                ruleConfig
            );

            if (!result.valid) {
                const isRequiredRule = ruleName === "required";

                if (
                    isRequiredRule &&
                    !showRequiredErrors &&
                    config.showRequiredMessagesOnSubmitnly
                ) {
                    return true;
                }

                let message = rule.message || result.message;

                message = message
                    .replace("{current}", value.length)
                    .replace("{max}", rule.value);

                showError(field, message, errorConfig);

                return true;
            }

            return false;
        });

        if (hasValidationError) {
            return false;
        }
        return true;
    };

    Object.keys(config.rules).forEach((fieldName) => {
        // eslint-disable-next-line secure-coding/detect-object-injection
        const ruleConfig = config.rules[fieldName];

        if (ruleConfig.selector) {
            document.querySelectorAll(ruleConfig.selector).forEach((field) => {
                    field.addEventListener("change", () =>
                        validateField(fieldName, false)
                    );
            });
        } else {
            const field = form.querySelector(`[name="${fieldName}"]`);

            if (!field) {
                return;
            }

            ["blur", "input", "change"].forEach(
                (eventName) => {
                    field.addEventListener(eventName,() => 
                        validateField(fieldName, false)
                    );
                }
            );
        }
    });

    form.addEventListener("submit", (event) => {
        let valid = true;
        let firstInvalidField = null;

        Object.keys(config.rules).forEach((fieldName) => {
            const fieldValid = validateField(fieldName);

            if (!fieldValid && !firstInvalidField) {
                // eslint-disable-next-line secure-coding/detect-object-injection
                const ruleConfig = config.rules[fieldName];
                firstInvalidField = ruleConfig.selector? document.querySelector(ruleConfig.selector): form.querySelector(`[name="${fieldName}"]`);
            }

            valid = valid && fieldValid;
        });

        if (!valid) {
            event.preventDefault();
            firstInvalidField?.scrollIntoView({ behavior: "smooth", block: "center" });
            firstInvalidField?.focus();
        }
    });

    return {
        validateForm() {
            let valid = true;
            Object.keys(config.rules).forEach((fieldName) => {
                valid = validateField(fieldName) && valid;
            });
            return valid;
        },validateField,form
    };
}

export function initCharacterCounter(fieldSelector,counterSelector,maxLength) {
    const field = document.querySelector(fieldSelector);
    if (!field) {
        return;
    }
    let counter = document.querySelector(counterSelector);

    if (!counter) {
        counter = document.createElement("div");
        if (counterSelector.startsWith("#")) {
            counter.id = counterSelector.replace("#", "");
        }
        field.insertAdjacentElement(
            "afterend",
            counter
        );
    }

    const update = () => {
        counter.textContent =`${field.value.length}/${maxLength}`;
    };

    update();

    field.addEventListener("input", update);
}