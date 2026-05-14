// Thin server-only wrappers so route.ts handlers can stay JSX-free.

import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { PoPdf, type PoPdfData } from './po';
import { SoPdf, type SoPdfData } from './so';
import { RfqPdf, type RfqPdfData } from './rfq';

export async function renderPoPdf(data: PoPdfData): Promise<Buffer> {
	return renderToBuffer(<PoPdf data={data} />);
}

export async function renderSoPdf(data: SoPdfData): Promise<Buffer> {
	return renderToBuffer(<SoPdf data={data} />);
}

export async function renderRfqPdf(data: RfqPdfData): Promise<Buffer> {
	return renderToBuffer(<RfqPdf data={data} />);
}
