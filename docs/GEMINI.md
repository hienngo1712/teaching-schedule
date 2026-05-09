# Project Mandates: Mobile-First UI/UX

> **FOUNDATIONAL RULE:** This project follows a strict **Mobile-First** approach. All UI/UX changes, new features, and refinements must be designed, implemented, and verified for mobile devices (screens >= 375px) BEFORE scaling up to desktop/web layouts.

## Mobile Optimization Standards
- **Touch-Friendly:** Buttons, links, and interactive elements must have a minimum touch target size (44x44px).
- **Space Efficiency:** Prioritize essential information. Use collapsible sections, bottom sheets, or drawers for secondary actions.
- **Fixed UI Elements:** Components like Pagination or Action Bars should be pinned (e.g., `sticky bottom-0`) and simplified for mobile (hide non-essential text/details).
- **One-Handed Operation:** Design primary navigation and actions to be easily reachable with one hand.
- **Horizontal Scrolling:** Avoid horizontal scrolling for the main page; use it only for data tables where absolutely necessary.

## Verification
A task is considered "Incomplete" if it has not been tested and optimized for a 375px viewport. Any UI that is merely "responsive" (doesn't break but is unusable/ugly on mobile) is rejected.
