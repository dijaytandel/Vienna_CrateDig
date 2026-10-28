# CrateDig — Product Requirements Document

_Source: Level 1 Specification: Strategy & Scope (Specification #1)._

> System Name: CrateDig · Author: Systems Analyst · Sponsor: Tyler Winslow · Date: October 2026

## 1. Strategy Layer

### 1.1 Project Summary

The CrateDig System is a specialized, location-aware digital platform designed to solve local inventory discovery friction for vinyl record collectors while driving foot traffic to independent retail storefronts. While established platforms like Discogs serve as global e-commerce archives and mail-order marketplaces, CrateDig addresses the local physical shopping gap. The platform connects nearby record store inventory with collector demand through real-time, crowdsourced record sightings and direct, merchant-posted inventory announcements—operating on a model similar to "GasBuddy for vinyl records."

CrateDig serves two primary consumer groups: experienced collectors seeking specific album pressings before committing to travel across town, and emerging collectors exploring local stores while organizing their personal collections to prevent duplicate purchases. Crucially, CrateDig is built to enhance—not replace—the tactile in-person "crate-digging" experience, deliberately excluding remote e-commerce, automated POS sync, and shipping fulfillment in favor of a clean, community-driven local discovery tool.

### 1.2 User Constituencies

The system caters to three primary user constituencies, each defined by distinct demographics, technical comfort levels, operational behaviors, and core system goals:

| User Constituency | Demographics & Tech Profile | Primary Goals & Needs | Key Frustrations & Pain Points |
|---|---|---|---|
| Experienced Collector (Persona: Maria Reed) | 35 years old; IT Support Specialist; 10+ years collecting; highly comfortable with mobile and web software. | Locate specific pressings locally; maintain targeted Want Lists; verify recent sightings before driving across town; avoid online shipping fees. | Wasting time and gas visiting multiple stores; lack of visibility into local shop stock; paying high shipping fees on online orders. |
| Emerging Collector (Persona: Elena Martinez) | 21 years old; College Student; novice collector; mobile-first smartphone power user. | Discover nearby independent record stores; catalog owned records to avoid accidental duplicate buys; browse community sighting trends. | Intimidation in traditional stores; buying duplicate albums by mistake; unaware of independent shops in her neighborhood. |
| Independent Store Manager (Merchant Partner) | 30–60 years old; independent retail owner/clerk; moderate tech proficiency; operates on busy store schedules. | Drive local foot traffic; announce fresh stock arrivals quickly; verify crowdsourced sighting accuracy without heavy data entry. | High technical friction of complex POS integration; competing with online e-commerce giants; limited marketing budget. |

### 1.3 Usage Contexts

The system operates across distinct physical environments, software platforms, and technical operating conditions:

- Hardware Platforms: Collectors interact primarily via iOS and Android smartphone web/native interfaces optimized for one-handed portrait orientation. Store Managers access the system via mobile smartphones or desktop web browsers at checkout counter terminals.
- Physical Environments: Collector usage occurs in physical retail store aisles (low light, dusty record bins, active foot traffic) or on-the-go (transit, vehicles, sidewalk corridors). Merchant usage occurs behind retail sales counters during busy store hours.
- Technical Operating Assumptions: Mobile devices must accommodate intermittent 4G/5G/Wi-Fi cellular coverage inside basement or brick-walled record shops using optimistic local caching. Location services (GPS) permission is assumed active for local distance calculation. Retail desktop terminals operate on persistent broadband internet connections.

## 2. Scope Layer

### 2.1 Updated Feature Chart

The feature architecture is structured into four functional domains based on client interview feedback and scope refinements:

| Functional Domain | Sub-Feature Module | System Capabilities & Operational Scope |
|---|---|---|
| 1.0 Collection & Want List Management | 1.1 Collection Cataloging | Catalog personal vinyl holdings with title, artist, year, genre, pressing detail, and condition notes to prevent duplicate purchases. |
| 1.0 Collection & Want List Management | 1.2 Want List Management | Maintain a target digital wishlist of desired albums and specific pressings for fast in-store bin referencing. |
| 1.0 Collection & Want List Management | 1.3 Want-to-Collection Transfer | Dynamically move an album entry from Want List to Personal Collection upon in-person acquisition. |
| 2.0 Local Sightings & Discovery Engine | 2.1 Radius & Keyword Search | Execute location-aware queries for specific albums/artists within a user-configured radius (e.g., 5, 10, 25 miles). |
| 2.0 Local Sightings & Discovery Engine | 2.2 Crowdsourced Reporting | Log new in-store record sightings with timestamp, retail location, price note, and condition rating. |
| 2.0 Local Sightings & Discovery Engine | 2.3 Store Directory | Browse verified local independent record shop profiles containing address, operating hours, phone, and policies. |
| 2.0 Local Sightings & Discovery Engine | 2.4 Map & Visual Feed | Display interactive map pin displays and chronological community activity feeds of recent local sightings. |
| 3.0 Merchant Partner Portal | 3.1 Stock Arrival Broadcasts | Post merchant updates announcing fresh inventory shipments, rare arrivals, or store highlight stock to local collectors. |
| 3.0 Merchant Partner Portal | 3.2 Sighting Verification | Confirm or flag crowdsourced user sighting entries to maintain active inventory accuracy for visiting shoppers. |
| 4.0 User Identity & Administration | 4.1 Role Authentication | Secure user login with role-based access control distinguishing Standard Collectors from Verified Store Managers. |
| 4.0 User Identity & Administration | 4.2 Preferences & Profile | Manage personal user details, location permissions, default search radius preferences, and alert notifications. |

### 2.2 Selected User Stories (Scope Inclusion)

The following 9 core user stories have been selected for implementation in Phase 1. Each story adheres strictly to the canonical user story format (As a <type of user>, I want to <specific action> so that <result>) and maps directly to a specific sub-feature module in the Feature Chart:

| ID | Linked Feature Module | Formatted User Story & Rationale |
|---|---|---|
| US-01 | 1.1 Collection Cataloging | As an experienced vinyl collector, I want to catalog my existing record inventory with album title, artist, and release pressing details so that I can avoid accidentally buying records I already own while shopping in stores. |
| US-02 | 1.2 Want List Management | As a vinyl collector, I want to maintain a digital Want List of specific albums and target pressings so that I have a quick reference list while browsing physical record bins. |
| US-03 | 1.3 Want-to-Collection Transfer | As a vinyl collector, I want to transfer an album directly from my Want List to my Personal Collection upon purchasing it so that my digital catalog updates instantly without re-entering album details. |
| US-04 | 2.1 Radius & Keyword Search | As an experienced vinyl collector, I want to search for a specific album within a customizable local geographic radius (e.g., 10 miles) so that I can see if it has been recently spotted nearby before driving across town. |
| US-05 | 2.2 Crowdsourced Reporting | As a vinyl collector, I want to report a record sighting at a local store with a timestamp, price note, and condition estimate so that other collectors in my community know where to find it. |
| US-06 | 2.3 Store Directory | As a novice vinyl collector, I want to browse a directory of nearby independent record stores with operating hours and addresses so that I can discover new local shops worth visiting. |
| US-07 | 2.4 Map & Visual Feed | As a novice vinyl collector, I want to view a map and visual feed of recent record sightings in my area so that I can explore what other local collectors are discovering. |
| US-08 | 3.1 Stock Arrival Broadcasts | As an independent record store manager, I want to post new inventory arrival announcements so that local collectors are notified about fresh stock in my store. |
| US-09 | 3.2 Sighting Verification | As an independent record store manager, I want to verify or update the status of crowdsourced record sightings at my store so that prospective shoppers receive accurate inventory information. |

## 3. Complete User Story List (29 Stories & Annotations)

Below is the comprehensive list of 29 generated user stories analyzed during the scope definition phase. A total of 9 stories were selected for Phase 1 scope, and 20 stories were rejected with detailed rationale annotations provided:

| # | User Story Text | Disposition | Annotation & Rejection Rationale |
|---|---|---|---|
| 1 | As an experienced vinyl collector, I want to catalog my existing record inventory with album title, artist, and release pressing details so that I can avoid accidentally buying records I already own while shopping in stores. | **SELECTED** | Included in Scope (Linked to Feature 1.1). |
| 2 | As a vinyl collector, I want to maintain a digital Want List of specific albums and target pressings so that I have a quick reference list while browsing physical record bins. | **SELECTED** | Included in Scope (Linked to Feature 1.2). |
| 3 | As a vinyl collector, I want to transfer an album directly from my Want List to my Personal Collection upon purchasing it so that my digital catalog updates instantly without re-entering album details. | **SELECTED** | Included in Scope (Linked to Feature 1.3). |
| 4 | As an experienced vinyl collector, I want to search for a specific album within a customizable local geographic radius (e.g., 10 miles) so that I can see if it has been recently spotted nearby before driving across town. | **SELECTED** | Included in Scope (Linked to Feature 2.1). |
| 5 | As a vinyl collector, I want to report a record sighting at a local store with a timestamp, price note, and condition estimate so that other collectors in my community know where to find it. | **SELECTED** | Included in Scope (Linked to Feature 2.2). |
| 6 | As a novice vinyl collector, I want to browse a directory of nearby independent record stores with operating hours and addresses so that I can discover new local shops worth visiting. | **SELECTED** | Included in Scope (Linked to Feature 2.3). |
| 7 | As a novice vinyl collector, I want to view a map and visual feed of recent record sightings in my area so that I can explore what other local collectors are discovering. | **SELECTED** | Included in Scope (Linked to Feature 2.4). |
| 8 | As an independent record store manager, I want to post new inventory arrival announcements so that local collectors are notified about fresh stock in my store. | **SELECTED** | Included in Scope (Linked to Feature 3.1). |
| 9 | As an independent record store manager, I want to verify or update the status of crowdsourced record sightings at my store so that prospective shoppers receive accurate inventory information. | **SELECTED** | Included in Scope (Linked to Feature 3.2). |
| 10 | As a vinyl collector, I want to purchase records directly through the app using my credit card so that the item is mailed to my house. | **REJECTED** | Out of Scope: Direct E-Commerce. In-app payment processing and shipping fulfillment are explicitly excluded from system boundaries. |
| 11 | As an independent record store manager, I want the app to automatically sync with my store's Point-of-Sale (POS) database so that my online catalog updates continuously. | **REJECTED** | Out of Scope: Automated POS Sync. Automated POS/ERP database sync is excluded in Phase 1 to eliminate integration overhead for small shops. |
| 12 | As a vinyl collector, I want to stream sample audio tracks of albums directly within the app so that I can listen to music before looking for the physical record. | **REJECTED** | Out of Scope: Audio Streaming. Audio playback integrations are excluded; CrateDig is a physical inventory locator, not a media streaming app. |
| 13 | As a vinyl collector, I want the system to calculate the financial resale value of my collection automatically based on recent online auction sales. | **REJECTED** | Out of Scope: Automated Valuation. Financial portfolio tracking and market resale pricing algorithms are explicitly declared out of scope. |
| 14 | As a vinyl collector, I want to scan a record's physical surface with my phone camera so that an AI algorithm can grade its physical condition. | **REJECTED** | Out of Scope: Optical Grading. Computer-vision grading algorithms are beyond system scope and technical complexity for initial launch. |
| 15 | As a vinyl collector, I want to arrange trades and send direct messages to other collectors nearby so that we can swap records in person. | **REJECTED** | Out of Scope: Peer-to-Peer Trading. User-to-user marketplace trading and messaging introduce liability and moderation overhead outside initial scope. |
| 16 | As a vinyl collector, I want to make a list of albums I hope to buy in the future so that I don't forget them. | **REJECTED** | Redundant. Identical in functional intent and scope to User Story #2 (Want List Management). |
| 17 | As an experienced collector, I want to look up an album by artist name to see if any local shops have it. | **REJECTED** | Redundant. Completely subsumed by the multi-parameter local search engine defined in User Story #4. |
| 18 | As a user, I want to see a list of record shops near my current location. | **REJECTED** | Redundant. Duplicates store directory browsing capabilities already fully defined in User Story #6. |
| 19 | As a music lover, I want the app to look nice and be easy to use so that I enjoy using it. | **REJECTED** | Vague / Non-Functional. Lacks specific user action, functional criteria, or measurable boundary conditions. |
| 20 | As a record shopper, I want to find good vinyl records easily so that I am happy. | **REJECTED** | Vague / Lacks Feature Link. Overly subjective statement failing to specify any actionable system capability. |
| 21 | As a developer, I want to set up a relational PostgreSQL database schema so that user data is stored efficiently. | **REJECTED** | Technical Implementation Detail. Describes backend database construction rather than end-user functional behavior. |
| 22 | As a system admin, I want to configure SSL encryption for API endpoints so that data transmission is secure. | **REJECTED** | Technical Non-Functional Requirement. Refers to architectural infrastructure security rather than user functional scope. |
| 23 | As a vinyl collector, I want to follow other collectors, like their posts, and write comments on their profiles so that I can build a social network. | **REJECTED** | Out of Scope: Social Network Feed. General social media features (following, liking, commenting) distract from core inventory localization. |
| 24 | As a record store manager, I want to sell tickets to live store concerts through the app so that customers can attend events. | **REJECTED** | Out of Scope: Ticket Sales. Live event ticketing and event management are entirely separate business domains outside record discovery scope. |
| 25 | As a store clerk, I want to attach an external Bluetooth barcode scanner to quickly scan incoming vinyl boxes. | **REJECTED** | Feature Creep: External Hardware Sync. Native integration with specialized external hardware creates unnecessary hardware dependencies for Phase 1. |
| 26 | As a store manager, I want to notify nearby users when we get a fresh box of used records. | **REJECTED** | Redundant. Duplicates merchant inventory arrival broadcasting capabilities defined in User Story #8. |
| 27 | As a vinyl collector, I want to place a 24-hour hold on a record at a local store through the app so that nobody buys it before I get there. | **REJECTED** | Out of Scope: In-App Inventory Holds. Digital holds require store POS database locking, which is excluded from Phase 1 scope. |
| 28 | As a collector, I want to track my favorite music genres so the app knows what I like. | **REJECTED** | Vague / Redundant. Genre filtering is already embedded directly in collection and search parameters (Features 1.1 & 2.1). |
| 29 | As a store owner, I want to print shipping labels for customers who live far away. | **REJECTED** | Out of Scope: Shipping Logistics. Order fulfillment and postal shipping label generation are explicitly declared out of scope. |

## 4. Implementation Decisions

_Not part of Specification #1. These clarifications from the project owner apply on top of the spec._

| Topic | Decision | Affects |
|---|---|---|
| Radius units | Default unit is **miles** (5 / 10 / 25). Users can switch to **kilometres** in their preferences. | 2.1, 4.2 |
| Sighting freshness | Crowdsourced sightings **auto-expire 30 days** after they are reported. | 2.2, 2.4, 3.2 |
| Merchant verification | Two paths to become a Verified Store Manager: (a) **corporate email binding**, where a confirmed email on the store's domain links the manager to that store; or (b) **document-based application**, where the manager submits supporting documents for manual review. | 4.1, 3.x |
| Broadcast delivery | Stock arrival broadcasts appear in the **in-app feed** and are also sent as **web push notifications** through the PWA. | 3.1, 4.2 |
| Catalog data source | Album metadata (title, artist, year, genre, pressing) comes from an **external catalog** and is read-only; no e-commerce features are used. | 1.1, 1.2, 2.1 |
