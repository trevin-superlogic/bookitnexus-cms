import type { SchemaTypeDefinition } from 'sanity';

import { brand, brandRole } from './documents/brand';
import { brandTheme, foundationTokens } from './documents/brandTheme';
import { copyEntry, pageContent, productContent, sharedContent } from './documents/content';
import { experienceConfig } from './documents/experienceConfig';
import { tenant } from './documents/tenant';
import { brandAssets, seoConfig } from './objects/brand';
import { onboardingConfig, onboardingSlide, paymentConfig, topUpConfig, topUpTile } from './objects/commerce';
import { footerConfig, footerLink } from './objects/footer';
import { navigationConfig, navItem } from './objects/navigation';
import { rewardsConfig } from './objects/rewards';
import {
  authControls,
  footerChrome,
  footerLinkGroup,
  legacyNavbar,
  navSlot,
  navbarConfig,
  nexusNavbar,
  siteMetadata,
  spreePayWidget,
} from './objects/siteChrome';
import { compiledTheme, storedToken, tokenOverride, tokenSet, validationReport } from './objects/tokens';

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  tenant,
  brand,
  experienceConfig,
  brandTheme,
  foundationTokens,
  sharedContent,
  productContent,
  pageContent,

  // Objects — configuration
  rewardsConfig,
  navigationConfig,
  navItem,
  footerConfig,
  footerLink,

  // Objects — site chrome (navbar, footer, metadata, payments widget)
  navSlot,
  authControls,
  nexusNavbar,
  legacyNavbar,
  navbarConfig,
  footerLinkGroup,
  footerChrome,
  siteMetadata,
  spreePayWidget,
  paymentConfig,
  topUpConfig,
  topUpTile,
  onboardingConfig,
  onboardingSlide,
  brandAssets,
  seoConfig,

  // Objects — content
  copyEntry,

  // Objects — brand book
  brandRole,

  // Objects — tokens
  storedToken,
  tokenOverride,
  tokenSet,
  compiledTheme,
  validationReport,
];
