/**
 * Structured marketing controls for each Bookit modality.
 *
 * The CMS owns page composition, labels, imagery and the API selectors that
 * choose which records appear. Experience, package, event, ticket and price
 * records remain owned by their source APIs.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

import { INHERITS } from "../lib/scope";

const destinationField = (name = "url", title = "Destination") =>
  defineField({
    name,
    title,
    type: "string",
    description: `Use a path beginning with "/" for this site or a full http(s) URL. ${INHERITS}`,
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || value.startsWith("/") || value.startsWith("http")
          ? true
          : 'Must be an internal path beginning with "/" or a full http(s) URL.',
      ),
  });

const imageField = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: "image",
    description: `${description} ${INHERITS}`,
    options: { hotspot: true },
    fields: [
      defineField({
        name: "alt",
        title: "Alt text",
        type: "string",
        validation: (Rule) =>
          Rule.required().warning(
            "Add alt text unless the image is purely decorative.",
          ),
      }),
    ],
  });

export const modalityHero = defineType({
  name: "modalityHero",
  title: "Hero",
  type: "object",
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: "heading",
      title: "Headline",
      type: "string",
      description: INHERITS,
    }),
    defineField({
      name: "subheading",
      title: "Subheading",
      type: "text",
      rows: 3,
      description: INHERITS,
    }),
    imageField(
      "image",
      "Hero image",
      "Wide image used on desktop and as the fallback on smaller screens.",
    ),
    imageField(
      "mobileImage",
      "Mobile hero image",
      "Optional portrait or mobile crop.",
    ),
  ],
});

export const editorialLink = defineType({
  name: "editorialLink",
  title: "Editorial link",
  type: "object",
  fields: [
    defineField({
      name: "visible",
      title: "Visible",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    destinationField(),
    defineField({
      name: "iconSvg",
      title: "Icon SVG",
      type: "image",
      description:
        "Optional icon. SVG only so it can inherit the current theme colours.",
      options: { accept: ".svg", hotspot: false },
      fields: [
        defineField({ name: "alt", title: "Accessible label", type: "string" }),
      ],
    }),
  ],
  preview: {
    select: { label: "label", url: "url", visible: "visible" },
    prepare: ({ label, url, visible }) => ({
      title: `${visible === false ? "○ " : ""}${label ?? "Untitled link"}`,
      subtitle: url,
    }),
  },
});

export const experienceCollection = defineType({
  name: "experienceCollection",
  title: "Experience collection",
  type: "object",
  fields: [
    defineField({
      name: "visible",
      title: "Visible",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceType",
      title: "Experience source",
      type: "string",
      description:
        "Chooses how the Experiences API is filtered. The CMS does not store the returned experiences.",
      options: {
        list: [
          { title: "Tag", value: "tag" },
          { title: "Category", value: "category" },
          { title: "Sweepstakes", value: "sweepstakes" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceKey",
      title: "API tag or category key",
      type: "string",
      description:
        "For example: curated, trending, exclusive, lifetime, or sports.",
      hidden: ({ parent }) => parent?.sourceType === "sweepstakes",
      validation: (Rule) =>
        Rule.custom((value, context) =>
          context.parent &&
          (context.parent as { sourceType?: string }).sourceType !==
            "sweepstakes" &&
          !value
            ? "Add the API tag or category key."
            : true,
        ),
    }),
    defineField({
      name: "itemLimit",
      title: "Maximum items",
      type: "number",
      validation: (Rule) => Rule.integer().min(1).max(24),
    }),
    defineField({
      name: "viewAllLabel",
      title: "View-all label",
      type: "string",
      description: INHERITS,
    }),
    destinationField("viewAllUrl", "View-all destination"),
  ],
  preview: {
    select: {
      heading: "heading",
      sourceType: "sourceType",
      sourceKey: "sourceKey",
      visible: "visible",
    },
    prepare: ({ heading, sourceType, sourceKey, visible }) => ({
      title: `${visible === false ? "○ " : ""}${heading ?? "Untitled collection"}`,
      subtitle: [sourceType, sourceKey].filter(Boolean).join(" · "),
    }),
  },
});

export const ticketCollection = defineType({
  name: "ticketCollection",
  title: "Ticket collection",
  type: "object",
  fields: [
    defineField({
      name: "visible",
      title: "Visible",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceType",
      title: "Event source",
      type: "string",
      description:
        "Chooses how the Ticketing API is filtered. The CMS does not store returned shows or tickets.",
      options: {
        list: [
          { title: "Popular near visitor", value: "nearby" },
          { title: "Ticket category", value: "category" },
          { title: "Featured events", value: "featured" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceId",
      title: "Ticketing API category ID",
      type: "string",
      description:
        "Required for a category collection, for example the API ID used by Concerts.",
      hidden: ({ parent }) => parent?.sourceType !== "category",
      validation: (Rule) =>
        Rule.custom((value, context) =>
          context.parent &&
          (context.parent as { sourceType?: string }).sourceType ===
            "category" &&
          !value
            ? "Add the Ticketing API category ID."
            : true,
        ),
    }),
    defineField({
      name: "itemLimit",
      title: "Maximum items",
      type: "number",
      validation: (Rule) => Rule.integer().min(1).max(24),
    }),
    defineField({
      name: "viewAllLabel",
      title: "View-all label",
      type: "string",
      description: INHERITS,
    }),
    destinationField("viewAllUrl", "View-all destination"),
  ],
  preview: {
    select: {
      heading: "heading",
      sourceType: "sourceType",
      sourceId: "sourceId",
      visible: "visible",
    },
    prepare: ({ heading, sourceType, sourceId, visible }) => ({
      title: `${visible === false ? "○ " : ""}${heading ?? "Untitled collection"}`,
      subtitle: [sourceType, sourceId].filter(Boolean).join(" · "),
    }),
  },
});

export const discoveryTile = defineType({
  name: "discoveryTile",
  title: "Discovery tile",
  type: "object",
  fields: [
    defineField({
      name: "visible",
      title: "Visible",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceId",
      title: "API identifier",
      type: "string",
      description:
        "Optional category, city, or other stable identifier used by the consuming API.",
    }),
    destinationField(),
    imageField(
      "image",
      "Image",
      "Marketing image for this category or destination.",
    ),
  ],
  preview: {
    select: { label: "label", url: "url", image: "image", visible: "visible" },
    prepare: ({ label, url, image, visible }) => ({
      title: `${visible === false ? "○ " : ""}${label ?? "Untitled tile"}`,
      subtitle: url,
      media: image,
    }),
  },
});

export const vipContentConfig = defineType({
  name: "vipContentConfig",
  title: "Experiences content controls",
  type: "object",
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: "homepage",
      title: "Homepage",
      type: "object",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "hero", title: "Hero", type: "modalityHero" }),
        defineField({
          name: "secondaryNavigation",
          title: "Discovery navigation",
          type: "array",
          description: `Ordered links below search, such as All, Sweeps, Trending, Sports, Music, Culinary, and Lifestyle. ${INHERITS}`,
          of: [defineArrayMember({ type: "editorialLink" })],
        }),
        defineField({
          name: "collections",
          title: "Experience collections",
          type: "array",
          description: `Ordered homepage carousels. Each item selects API records by tag or category. ${INHERITS}`,
          of: [defineArrayMember({ type: "experienceCollection" })],
        }),
        defineField({
          name: "categoryTiles",
          title: "Category tiles",
          type: "array",
          description: `Ordered marketing tiles for Sports, Music, Culinary, Lifestyle, and future categories. ${INHERITS}`,
          of: [defineArrayMember({ type: "discoveryTile" })],
        }),
        defineField({
          name: "heading",
          title: "Headline (legacy)",
          type: "string",
          readOnly: true,
          hidden: ({ value }) => value === undefined,
          deprecated: { reason: "Use Homepage → Hero → Headline." },
        }),
        defineField({
          name: "subheading",
          title: "Subheading (legacy)",
          type: "text",
          readOnly: true,
          hidden: ({ value }) => value === undefined,
          deprecated: { reason: "Use Homepage → Hero → Subheading." },
        }),
        defineField({
          name: "carouselHeadings",
          title: "Carousel headings (legacy)",
          type: "array",
          readOnly: true,
          hidden: ({ value }) => value === undefined,
          deprecated: {
            reason:
              "Use Experience collections, which also define the API source and destination.",
          },
          of: [defineArrayMember({ type: "string" })],
        }),
      ],
    }),
    defineField({
      name: "searchPlaceholder",
      title: "Search hint",
      type: "string",
      description: `Placeholder shown in Experiences search, e.g. "Search experiences". ${INHERITS}`,
    }),
    defineField({
      name: "searchResults",
      title: "Search and listing pages",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "resultsHeading",
          title: "Results heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "emptyHeading",
          title: "No-results heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "emptyBody",
          title: "No-results message",
          type: "text",
          rows: 3,
          description: INHERITS,
        }),
      ],
    }),
    defineField({
      name: "detailPage",
      title: "Experience detail",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "bookLabel",
          title: "Book button label",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "soldOutLabel",
          title: "Sold-out label",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "aboutHeading",
          title: "About heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "includedHeading",
          title: "What is included heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "relatedHeading",
          title: "Related experiences heading",
          type: "string",
          description: INHERITS,
        }),
      ],
    }),
    defineField({
      name: "sweepstakes",
      title: "Sweepstakes",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: "hero", title: "Hero", type: "modalityHero" }),
        defineField({
          name: "rulesText",
          title: "Rules and marketing consent text",
          type: "text",
          rows: 6,
          description: INHERITS,
        }),
        defineField({
          name: "heading",
          title: "Heading (legacy)",
          type: "string",
          deprecated: { reason: "Use Hero → Headline." },
        }),
        defineField({
          name: "subheading",
          title: "Subheading (legacy)",
          type: "string",
          deprecated: { reason: "Use Hero → Subheading." },
        }),
      ],
    }),
  ],
});

export const ticketingContentConfig = defineType({
  name: "ticketingContentConfig",
  title: "Ticketing content controls",
  type: "object",
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: "homepage",
      title: "Homepage",
      type: "object",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "hero", title: "Hero", type: "modalityHero" }),
        defineField({
          name: "searchPlaceholder",
          title: "Event search hint",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "locationPlaceholder",
          title: "Location search hint",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "dateFilterLabels",
          title: "Quick-date labels",
          type: "object",
          description:
            "Labels only. The application continues to calculate the actual date ranges.",
          fields: [
            defineField({
              name: "tomorrow",
              title: "Tomorrow",
              type: "string",
              description: INHERITS,
            }),
            defineField({
              name: "thisWeekend",
              title: "This weekend",
              type: "string",
              description: INHERITS,
            }),
            defineField({
              name: "nextWeekend",
              title: "Next weekend",
              type: "string",
              description: INHERITS,
            }),
            defineField({
              name: "otherDates",
              title: "Other dates",
              type: "string",
              description: INHERITS,
            }),
          ],
        }),
        defineField({
          name: "collections",
          title: "Event collections",
          type: "array",
          description: `Ordered sections such as Popular near you, Concerts, Sports, and Theater. ${INHERITS}`,
          of: [defineArrayMember({ type: "ticketCollection" })],
        }),
        defineField({
          name: "categoryTiles",
          title: "Category tiles",
          type: "array",
          description: `Ordered marketing tiles such as Concerts, Sports, Theater, and Special Events. ${INHERITS}`,
          of: [defineArrayMember({ type: "discoveryTile" })],
        }),
        defineField({
          name: "popularCities",
          title: "Popular city tiles",
          type: "array",
          description: `Ordered city destinations such as Las Vegas, New York City, London, and Chicago. ${INHERITS}`,
          of: [defineArrayMember({ type: "discoveryTile" })],
        }),
        defineField({
          name: "heading",
          title: "Heading (legacy)",
          type: "string",
          readOnly: true,
          hidden: ({ value }) => value === undefined,
          deprecated: { reason: "Use Homepage → Hero → Headline." },
        }),
        defineField({
          name: "subheading",
          title: "Subheading (legacy)",
          type: "text",
          readOnly: true,
          hidden: ({ value }) => value === undefined,
          deprecated: { reason: "Use Homepage → Hero → Subheading." },
        }),
      ],
    }),
    defineField({
      name: "browse",
      title: "Browse and search results",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        imageField(
          "heroImage",
          "Browse hero image",
          "Background for category, city, and search-result headers.",
        ),
        imageField(
          "mobileHeroImage",
          "Mobile browse hero image",
          "Optional mobile crop.",
        ),
        defineField({
          name: "resultsHeading",
          title: "Results heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "emptyHeading",
          title: "No-events heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "emptyBody",
          title: "No-events message",
          type: "text",
          rows: 3,
          description: INHERITS,
        }),
      ],
    }),
    defineField({
      name: "eventDetail",
      title: "Event detail",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "selectTicketsLabel",
          title: "Select tickets label",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "soldOutLabel",
          title: "Sold-out label",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "relatedHeading",
          title: "Related events heading",
          type: "string",
          description: INHERITS,
        }),
        defineField({
          name: "pricingDisclosure",
          title: "Pricing disclosure",
          type: "text",
          rows: 3,
          description: INHERITS,
        }),
      ],
    }),
  ],
});
