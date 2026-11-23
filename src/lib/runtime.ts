// True in the single-file build that is published as a claude.ai artifact.
// There, storage / AI / voice come from the artifact's runtime capabilities
// (window.claude.use) instead of IndexedDB and API keys.
export const IS_ARTIFACT = import.meta.env.MODE === 'artifact';
