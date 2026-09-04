// The one place the product's names live. This instance is The PR Hub's
// Company OS; the platform underneath is 8 Edges Company OS. Change these
// and every shell wordmark, page title, email subject and sign-off follows.
//
// Not covered here on purpose: database enum values (`source='edge8'`,
// invoice `entity`, objective `brand`), cookie and storage keys, the
// `@edge8.local` sentinel addresses, stored CRM attribution values, and the
// verified sender defaults — those are identifiers, not brand text.

export const BRAND = "The PR Hub";
export const BRAND_SHORT = "PR Hub";
export const BRAND_TEAM = `${BRAND} Team`;
export const BRAND_PORTAL = `${BRAND} Client Portal`;
export const BRAND_SIGNOFF = `The ${BRAND_SHORT} team`;
export const PRODUCT = "8 Edges Company OS";
// Contact points used in legal pages, emails and the unsubscribe flow.
export const BRAND_EMAIL = "hello@theprhub.com.au";
export const BRAND_DOMAIN = "theprhub.com.au";
export const BRAND_LEGAL = "The PR Hub";
