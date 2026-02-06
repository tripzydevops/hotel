---
name: stitch-loop
description: Teaches agents to iteratively build websites using Stitch with an autonomous baton-passing loop pattern
allowed-tools:
  - "stitch*:*"
  - "Bash"
  - "Read"
  - "Write"
  - "web_fetch"
---

# Stitch Build Loop

## Overview

This skill teaches you how to iteratively build multi-page websites using Stitch. It follows a "Baton System" where each step documentation what was done and what needs to happen next, allowing for long-running, autonomous development.

## Prerequisites

- Access to the Stitch MCP Server
- A target directory for the web project
- (Optional) A `DESIGN.md` file for visual consistency

## The Baton System

The loop is driven by a file named `next-prompt.md`. This file contains the goal for the next iteration and a summary of the site's current state.

### Baton Structure

```markdown
# Current Task: [Short Task Name]

**Site Map:**

- [Page Name] ([Path]) - [Status: Done/Planned]

**Next Steps:**

1. [Step 1]
2. [Step 2]

**Site Vision:** [One sentence description]
```

## Execution Protocol

### Step 1: Read the Baton

Locate and read `next-prompt.md` to understand your current objective.

### Step 2: Consult Context Files

Read `DESIGN.md` (if available) to extract design tokens and `SITE.md` to understand the overall architecture.

### Step 3: Generate with Stitch

Use the Stitch MCP tools to create or update a screen.

1. Call `stitch:get_project` or `stitch:create_project` to ensure you have a project space.
2. Call `stitch:create_screen` with a prompt that includes:
   - The specific page goal from the baton
   - The design system block from `DESIGN.md`
   - Navigation instructions (e.g., "Link 'About' to 'about.html'")

### Step 4: Integrate into Site

1. Download the generated HTML from `htmlCode.downloadUrl`.
2. Save it to the appropriate path in your project directory.
3. If an existing page was updated, overwrite the old file.

### Step 4.5: Visual Verification (Optional)

Check `screenshot.downloadUrl` to ensure the generated page meets quality standards.

### Step 5: Update Site Documentation

1. Update `SITE.md` to reflect the new page status.
2. Log the changes in your progress report.

### Step 6: Prepare the Next Baton (Critical)

Update `next-prompt.md` with:

1. The result of the current step.
2. The exact instructions for the next required page or feature.

## File Structure Reference

```
project/
├── next-prompt.md      # The baton — current task
├── stitch.json         # Stitch project ID (persist this!)
├── DESIGN.md           # Visual design system (from design-md skill)
├── SITE.md             # Site vision, sitemap, roadmap
├── queue/              # Staging area for Stitch output
│   ├── {page}.html
│   └── {page}.png
└── site/public/        # Production pages
    ├── index.html
    └── {page}.html
```

## Orchestration Options

The loop can be driven by different orchestration layers:

| Method            | How it works                                           |
| ----------------- | ------------------------------------------------------ |
| **CI/CD**         | GitHub Actions triggers on `next-prompt.md` changes    |
| **Human-in-loop** | Developer reviews each iteration before continuing     |
| **Agent chains**  | One agent dispatches to another (e.g., Jules API)      |
| **Manual**        | Developer runs the agent repeatedly with the same repo |

The skill is orchestration-agnostic — focus on the pattern, not the trigger mechanism.

## Design System Integration

This skill works best with the `design-md` skill:

1. **First time setup**: Generate `DESIGN.md` using the `design-md` skill from an existing Stitch screen
2. **Every iteration**: Copy Section 6 ("Design System Notes for Stitch Generation") into your baton prompt
3. **Consistency**: All generated pages will share the same visual language

## Common Pitfalls

- ❌ Forgetting to update `next-prompt.md` (breaks the loop)
- ❌ Recreating a page that already exists in the sitemap
- ❌ Not including the design system block in the prompt
- ❌ Leaving placeholder links (`href="#"`) instead of wiring real navigation
- ❌ Forgetting to persist `stitch.json` after creating a new project

## Troubleshooting

| Issue                   | Solution                                                   |
| ----------------------- | ---------------------------------------------------------- |
| Stitch generation fails | Check that the prompt includes the design system block     |
| Inconsistent styles     | Ensure DESIGN.md is up-to-date and copied correctly        |
| Loop stalls             | Verify `next-prompt.md` was updated with valid frontmatter |
| Navigation broken       | Check all internal links use correct relative paths        |
