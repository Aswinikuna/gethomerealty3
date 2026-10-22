/** Site-relative media paths ("assets/img/…") resolved from the site root, not /admin/…. */
export const mediaSrc = (u: string | null | undefined) => (!u ? '' : /^(https?:|\/|blob:|data:)/.test(u) ? u : `/${u}`);
