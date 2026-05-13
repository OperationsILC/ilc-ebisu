'use client';

import { useActionState } from 'react';
import { uploadCsv, type UploadResult } from './actions';

export default function UploadForm({ projectId }: { projectId: string }) {
	const action = uploadCsv.bind(null, projectId);
	const [state, formAction, pending] = useActionState<UploadResult | undefined, FormData>(
		action,
		undefined
	);

	return (
		<>
			{state?.error && <p className="flash error">{state.error}</p>}

			<form
				action={formAction}
				encType="multipart/form-data"
				style={{ marginTop: '20px' }}
			>
				<label>
					CSV file: <input type="file" name="csv" accept=".csv,text/csv" required />
				</label>
				<button className="primary" type="submit" style={{ marginLeft: '12px' }} disabled={pending}>
					{pending ? 'Parsing…' : 'Upload + parse'}
				</button>
			</form>
		</>
	);
}
