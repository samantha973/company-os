// The upstream private-library data is stripped from this public snapshot by
// the confidentiality sync. An empty list keeps the documented-workflows count
// working with public workflows and published docs only.
export type PrivateLibraryItem = {
  category: string
  href: string
  title?: string
  brand?: string
}

export const allPrivateItems: PrivateLibraryItem[] = []
