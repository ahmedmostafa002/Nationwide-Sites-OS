export interface NavLink {
  label: string;
  href: string;
  zip?: string;
}

export interface NavItem {
  label: string;
  href: string;
  dropdown: NavLink[];
}

export interface SiteManifestPage {
  id: string;
  pageType: "homepage" | "service" | "state" | "city" | "city-service" | "about" | "contact";
  slug: string;
  title: string;
  description: string;
  serviceKey?: string;
  state?: string;
  city?: string;
  zip?: string;
  keywords: string[];
  internalLinks: string[];
  serviceLinks?: NavLink[];
  locationLinks?: NavLink[];
  seoTitle: string;
  metaDescription: string;
  headingGuidance?: string;
  seoNotes?: string;
  pageGuidance?: string;
  contentGuidelines?: string;
  content?: string;
}

export interface SiteManifest {
  projectId: string;
  siteName: string;
  brandName: string;
  primaryState?: string;
  templateFamily: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    fontHeading: string;
    fontBody: string;
    imageDirection: string;
  };
  navigation?: {
    main: NavItem[];
  };
  siteGuidance?: string;
  counts: {
    totalPages: number;
    servicePages: number;
    statePages: number;
    cityPages: number;
    cityServicePages: number;
    aboutPages: number;
    contactPages: number;
  };
  serviceKeys: string[];
  stateCodes: string[];
  pagePlan: SiteManifestPage[];
}