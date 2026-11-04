export type SyncStage = 'download' | 'validation' | 'save';
/** Never display arbitrary server/database messages or activity data. */
export function syncFailure(stage:SyncStage,error:unknown):string {
 const raw=error&&typeof error==='object'&&'name' in error?String(error.name):'';
 const known=['QuotaExceededError','ConstraintError','DatabaseClosedError','InvalidStateError','TransactionInactiveError','PrematureCommitError','AbortError','DataError','BulkError'];
 const code=known.includes(raw)?raw:'UnknownError';
 if(stage==='download')return 'Could not download private runs. Check your connection and retry. [download]';
 if(stage==='validation')return 'Private runs downloaded, but the app could not read them. Saved history is unchanged. [validation]';
 if(code==='QuotaExceededError')return 'Private runs downloaded, but this device has insufficient browser storage. Save a backup before changing storage settings. [save:QuotaExceededError]';
 return `Private runs downloaded, but could not be saved on this device. Keep your saved data and retry. [save:${code}]`;
}
