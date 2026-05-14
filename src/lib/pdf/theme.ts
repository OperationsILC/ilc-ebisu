// ILC brand tokens for PDF documents. Kept in one file so re-skinning later is
// a single edit. Hex codes sampled to match the orange in `ILC Studios Filled.png`.

export const ILC_ORANGE = '#F58220';
export const ILC_BLACK = '#111111';
export const MUTED = '#666666';
export const RULE = '#dddddd';
export const STRIPE = '#fafafa';

// Default text size: small enough to fit dense procurement tables, big enough
// to read in print.
export const FS = {
	tiny: 7,
	small: 8,
	body: 9,
	label: 10,
	h2: 12,
	h1: 18,
	doc: 22
};

// Margins (in pt; 72pt = 1 inch). US Letter is 612x792 pt.
export const PAGE_MARGIN = { top: 36, bottom: 56, left: 36, right: 36 };

// Default ILC office address printed in PDF footer / "from" block. Override
// per-PO via the shipToText / ilcOfficeAddress fields on the row if needed.
export const ILC_OFFICE_DEFAULT = {
	name: 'ILC Studios',
	address: '1234 Lighting Way',
	cityStateZip: 'City, ST 00000',
	email: 'orders@ilcstudios.com',
	website: 'ilcstudios.com'
};
