let pdfMakePromise;

/**
 * Load pdfMake without installing an npm package.
 */
export function loadPdfMake() {
  if (window.pdfMake) {
    return Promise.resolve(window.pdfMake);
  }

  if (pdfMakePromise) {
    return pdfMakePromise;
  }

  pdfMakePromise = new Promise((resolve, reject) => {
    const pdfScript = document.createElement('script');

    pdfScript.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.23/pdfmake.min.js';

    pdfScript.onload = () => {
      const fontsScript = document.createElement('script');

      fontsScript.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.23/vfs_fonts.min.js';

      fontsScript.onload = () => {
        resolve(window.pdfMake);
      };

      fontsScript.onerror = () => {
        reject(
          new Error('Unable to load pdfMake fonts.'),
        );
      };

      document.head.appendChild(fontsScript);
    };

    pdfScript.onerror = () => {
      reject(
        new Error('Unable to load pdfMake.'),
      );
    };

    document.head.appendChild(pdfScript);
  });

  return pdfMakePromise;
}

/**
 * Format today's date as MM/DD/YYYY.
 */
function getDate() {
    const today = new Date();

    let day = today.getDate();
    let month = today.getMonth() + 1;
    const year = today.getFullYear();

    if (day < 10) {
        day = `0${day}`;
    }

    if (month < 10) {
        month = `0${month}`;
    }

    return `${month}/${day}/${year}`;
}

/**
 * Get website value exactly like the existing site.
 */
function getWebsite(value) {
    return value === '' || value === undefined || value === null
        ? 'N/A'
        : value;
}

/**
 * Get enrollment form value exactly like existing site.
 */
function getEnrollmentForm(value) {
    if (
        value === ''
        || value === undefined
        || value === null
        || String(value).toLowerCase() === 'n/a'
    ) {
        return 'N/A';
    }

    return value;
}

/**
 * Get facility type.
 *
 * Existing site converts:
 *
 * Infusion Center
 *        ↓
 * Infusion Service Provider
 */
function getFacilityType(type) {
    return type === 'Infusion Center'
        ? 'Infusion Service Provider'
        : type || 'N/A';
}

/**
 * Get phone number.
 */
function getPhone(phone) {
    return phone === ''
        || phone === undefined
        || phone === null
        ? 'N/A'
        : phone;
}

/**
 * Create one result row.
 */
function createResultRow(result) {
    const website = getWebsite(result.website);
    const enrollmentForm = getEnrollmentForm(
        result.enrollmentForm,
    );

    return [
        {
            text: result.name || 'N/A',
            style: 'table',
            margin: 8,
        },

        {
            text: getFacilityType(result.type),
            style: 'table',
            margin: 8,
        },

        {
            text: `${result.miles} miles away`,
            style: 'table',
            margin: 8,
            alignment: 'center',
        },

        {
            text: result.address || 'N/A',
            style: 'table',
            margin: 8,
        },

        {
            text: getPhone(result.phone),
            style: 'table',
            margin: 8,
        },

        {
            text: website,
            style: 'table',
            margin: 8,

            /*
             * Make website clickable when available.
             */
            link:
                website === 'N/A'
                    ? ''
                    : website,
        },

        {
            text: enrollmentForm,
            style: 'table',
            margin: 8,

            /*
             * Make referral form clickable.
             */
            link:
                enrollmentForm === 'N/A'
                    ? ''
                    : enrollmentForm,
        },
    ];
}

/**
 * Generate PDF.
 *
 * @param {Array} results
 * @param {Object} options
 */
export async function downloadResultsPdf(
    results,
    options = {},
) {
    await loadPdfMake();
     
    if (!Array.isArray(results) || results.length === 0) {
        /* eslint-disable-next-line no-console */
        console.warn(
            'No results available for PDF.',
        );

        return;
    }

    try {
        const pdfMake = await loadPdfMake();

        
        const {
            pdfTitle = 'Infusion Service Providers in your area',
            disclaimerText = '',
            copyrightText = '',
            // eslint-disable-next-line max-len
            vlogo = 'data:image/png;base64,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',
            // eslint-disable-next-line max-len
            logo = 'data:image/png;base64,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',

        } = options;

        /*
         * --------------------------------------------------
         * TABLE DATA
         * --------------------------------------------------
         */

        const mainData = [];

        /*
         * Header row.
         */
        mainData[0] = [
            {
                text: 'Facility Name',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Facility Type or Specialty',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Number of Miles Away',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Facility Address',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Telephone Number',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Website Address',
                style: 'header',
                margin: 8,
            },

            {
                text: 'Patient Referral Form',
                style: 'header',
                margin: 8,
            },
        ];

        /*
         * Add result rows.
         */
        results.forEach((result) => {
            mainData.push(
                createResultRow(result),
            );
        });

        /*
         * --------------------------------------------------
         * DOCUMENT DEFINITION
         * --------------------------------------------------
         */

        const docDefinition = {
            pageOrientation: 'landscape',

            pageSize: 'A4',

            /*
             * EXACT same margins as existing implementation.
             */
            pageMargins: [
                24,
                70,
                24,
                140,
            ],

            /*
             * ------------------------------------------------
             * HEADER
             * ------------------------------------------------
             */
            header: {
                columns: [
                    /*
                     * Left logo
                     */
                    logo
                        ? {
                            image: logo,
                            width: 66,
                            height: 28,
                            margin: [
                                24,
                                15,
                                0,
                                5,
                            ],
                            alignment: 'left',
                        }
                        : {
                            text: '',
                        },

                    /*
                     * Center title
                     */
                    {
                        text: pdfTitle,
                        alignment: 'center',
                        fontSize: 10,
                        bold: true,
                        margin: [
                            10,
                            42,
                            10,
                            5,
                        ],
                    },

                    /*
                     * Right VYEPTI logo
                     */
                    vlogo
                        ? {
                            image: vlogo,
                            width: 75,
                            height: 45,
                            margin: [
                                0,
                                15,
                                14,
                                5,
                            ],
                            alignment: 'right',
                        }
                        : {
                            text: '',
                        },
                ],
            },

            /*
             * ------------------------------------------------
             * CONTENT
             * ------------------------------------------------
             */
            content: [
                {
                    table: {
                        /*
                         * Repeat first row on every page.
                         */
                        headerRows: 1,

                        /*
                         * Keep individual result rows together.
                         */
                        dontBreakRows: true,

                        /*
                         * Exact widths from existing site.
                         */
                        widths: [
                            '14%',
                            '12.8%',
                            '12.4%',
                            '16.5%',
                            '12.9%',
                            '15.4%',
                            '16%',
                        ],

                        body: mainData,
                    },
                },
            ],

            /*
             * ------------------------------------------------
             * STYLES
             * ------------------------------------------------
             */
            styles: {
                /*
                 * Exact existing header style.
                 */
                header: {
                    fontSize: 6,
                    alignment: 'center',
                },

                /*
                 * Exact existing table style.
                 */
                table: {
                    fontSize: 5,
                    lineHeight: 1.5,
                    alignment: 'center',
                },

                /*
                 * Exact existing footer style.
                 */
                footer: {
                    fontSize: 6,
                    margins: [
                        24,
                        0,
                        24,
                        24,
                    ],
                    alignment: 'center',
                },
            },

            /*
             * ------------------------------------------------
             * FOOTER
             * ------------------------------------------------
             */
            footer: (
                currentPage,
                pageCount,
            ) => {
                const footerData = [];

                /*
                 * Disclaimer.
                 *
                 * It spans all three columns.
                 */
                footerData[0] = [
                    {
                        text: disclaimerText,
                        style: 'footer',
                        bold: true,
                        alignment: 'center',
                        colSpan: 3,
                    },

                    {},

                    {},
                ];

                /*
                 * Bottom footer row.
                 */
                footerData[1] = [
                    {
                        text: `Date printed: ${getDate()}`,
                        style: 'footer',
                        margins: [
                            24,
                            5,
                            24,
                            5,
                        ],
                    },

                    {
                        text: copyrightText,
                        style: 'footer',
                        alignment: 'center',
                    },

                    {
                        text:
                            `Page no: ${currentPage} of ${pageCount}`,

                        style: 'footer',

                        alignment: 'right',

                        margins: [
                            24,
                            5,
                            24,
                            5,
                        ],
                    },
                ];

                return {
                    table: {
                        widths: [
                            'auto',
                            '70%',
                            'auto',
                        ],

                        margins: [
                            24,
                            5,
                            24,
                            5,
                        ],

                        body: footerData,
                    },

                    layout: {
                        hLineWidth: () => 0,

                        vLineWidth: () => 0,

                        paddingLeft: () => 20,

                        paddingRight: () => 20,

                        paddingTop: () => 5,

                        paddingBottom: () => 5,
                    },
                };
            },

            /*
             * ------------------------------------------------
             * TABLE BORDER
             * ------------------------------------------------
             */
            layout: {
                hLineWidth: () => 0.3,

                vLineWidth: () => 0.3,
            },
        };

        /*
         * --------------------------------------------------
         * DOWNLOAD
         * --------------------------------------------------
         */
        pdfMake
            .createPdf(docDefinition)
            .download(
                'vyepti-infusion-locator-results.pdf',
            );
    } catch (error) {
         /* eslint-disable-next-line no-console */
        console.error(
            'Failed to generate PDF:',
            error,
        );
    }
}