import ProjectForm from '../ProjectForm';
import { loadProjectFormOptions } from '../form-loaders';

export default async function NewProjectPage() {
	const { allUsers, clientCompanies, gcCompanies, designerCompanies } =
		await loadProjectFormOptions();

	return (
		<>
			<p>
				<a href="/projects">← back to projects</a>
			</p>
			<h1>New project</h1>
			<ProjectForm
				mode="create"
				users={allUsers}
				clientCompanies={clientCompanies}
				gcCompanies={gcCompanies}
				designerCompanies={designerCompanies}
			/>
		</>
	);
}
