import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ProjectForm from '../../ProjectForm';
import { loadProjectFormOptions } from '../../form-loaders';

export default async function EditProjectPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const { allUsers, clientCompanies, gcCompanies, designerCompanies } =
		await loadProjectFormOptions();

	return (
		<>
			<p>
				<a href={`/projects/${id}`}>← {project.name}</a>
			</p>
			<h1>Edit project: {project.name}</h1>
			<ProjectForm
				mode="edit"
				project={{
					id: project.id,
					name: project.name,
					status: project.status,
					phase: project.phase,
					projectType: project.projectType,
					serviceType: project.serviceType,
					clientCompanyId: project.clientCompanyId,
					gcCompanyId: project.gcCompanyId,
					designerCompanyId: project.designerCompanyId,
					projectManagerUserId: project.projectManagerUserId,
					designLeadUserId: project.designLeadUserId,
					secondDesignerUserId: project.secondDesignerUserId,
					salesPersonUserId: project.salesPersonUserId,
					caManagerUserId: project.caManagerUserId,
					ifcSubDate: project.ifcSubDate?.toISOString() ?? null,
					expectedOrderDate: project.expectedOrderDate?.toISOString() ?? null,
					designStartDate: project.designStartDate?.toISOString() ?? null,
					roughInStartDate: project.roughInStartDate?.toISOString() ?? null,
					constructionStartDate: project.constructionStartDate?.toISOString() ?? null,
					marginPct: project.marginPct,
					freightPct: project.freightPct,
					warehousingPct: project.warehousingPct,
					salesTaxPct: project.salesTaxPct,
					salesTaxName: project.salesTaxName,
					projectedDesignFeeTotal: project.projectedDesignFeeTotal,
					targetBudgetTotal: project.targetBudgetTotal,
					targetDollarsPerSf: project.targetDollarsPerSf,
					emailsForBudgets: project.emailsForBudgets,
					emailsForQuotesSo: project.emailsForQuotesSo,
					emailsForShipmentUpdates: project.emailsForShipmentUpdates,
					deliveryStreet: project.deliveryStreet,
					deliveryCity: project.deliveryCity,
					deliveryState: project.deliveryState,
					deliveryZip: project.deliveryZip,
					deliverySiteContactName: project.deliverySiteContactName,
					deliverySiteContactPhone: project.deliverySiteContactPhone,
					siteStreet: project.siteStreet,
					siteCity: project.siteCity,
					siteState: project.siteState,
					siteZip: project.siteZip,
					jobSiteContactName: project.jobSiteContactName,
					jobSiteContactPhone: project.jobSiteContactPhone,
					totalSf: project.totalSf,
					interiorSf: project.interiorSf,
					exteriorSf: project.exteriorSf,
					numUnitsRooms: project.numUnitsRooms,
					unitRoomSf: project.unitRoomSf,
					garageSf: project.garageSf,
					bohSf: project.bohSf,
					openOfficeSf: project.openOfficeSf,
					privateOfficeSf: project.privateOfficeSf,
					corridorAreaSf: project.corridorAreaSf,
					amenityAreaSf: project.amenityAreaSf,
					unfinishedOfficeSf: project.unfinishedOfficeSf,
					description: project.description,
					notes: project.notes,
					projectStats: project.projectStats
				}}
				users={allUsers}
				clientCompanies={clientCompanies}
				gcCompanies={gcCompanies}
				designerCompanies={designerCompanies}
			/>
		</>
	);
}
