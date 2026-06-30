# Tool Anatomy Standard — DesignLab

> **Last updated**: 2026-06  
> **Enforced by**: Code review. All new tools MUST follow this structure.

---

## Mandatory Folder Structure

Every tool in `tools/ai-tools/` or `tools/utility-tools/` MUST conform to this layout:

```
tools/{category}/{tool-slug}/
├── index.tsx           # REQUIRED — Default-exported React component (the tool UI)
├── actions.ts          # REQUIRED for AI tools — Server Actions only (no UI code)
├── types.ts            # Recommended — TypeScript types scoped to this tool
├── constants.ts        # If needed — Magic values, config (never hardcode in component)
├── use{ToolName}.ts    # If complex — Primary stateful hook (keeps index.tsx thin)
└── components/         # If needed — Tool-specific sub-components
    └── index.ts        #   Barrel export for sub-components
```

### Rules

| Rule | Rationale |
|------|-----------|
| `index.tsx` must be the only default export | The slug route loader (`[slug]/page.tsx`) imports `default` |
| AI tools MUST have `actions.ts` with `'use server'` at top | Keeps server code isolated from client bundle |
| No tool may import from another tool's folder | Cross-tool imports must go through `tools/shared/` |
| No tool may import from `app/dashboard/` internals | Routing layer must not leak into domain layer |
| `metadata` (page title/description) goes in the route's `page.tsx`, not in the tool component | Tools are reusable; routes are not |

---

## Registering a New Tool

1. **Add to tool registry** — `tools/tool-registry.ts`:
   ```ts
   {
     slug: 'my-new-tool',
     displayName: 'My New Tool',
     description: 'Short description for the hub card',
     category: 'utility-tools', // or 'ai-tools'
     route: '/dashboard/designer-hub/my-new-tool',
     creditCost: 0, // 0 = free; AI tools use DB value
     icon: SomeIcon,
     isAI: false,
     status: 'active',
   }
   ```

2. **Create the tool folder**:
   ```
   tools/utility-tools/my-new-tool/
   ├── index.tsx
   └── components/
   ```

3. **Add to the loader map** — `app/dashboard/designer-hub/[slug]/page.tsx`:
   ```ts
   'my-new-tool': () => import('@tools/utility-tools/my-new-tool/index'),
   ```

4. **Done.** The hub grid, metadata, 404 handling, and SSG all update automatically.

---

## Shared Infrastructure

Import shared tool infrastructure from these canonical paths:

| What | Import from |
|------|------------|
| GlobalCropModal | `@tools/shared/components/GlobalCropModal` |
| ImageUploader | `@tools/shared/components/ImageUploader` |
| ToolSkeleton | `@tools/shared/components/ToolSkeleton` |
| ErrorBoundary | `@tools/shared/components/ErrorBoundary` |
| useTool hook | `@tools/shared/hooks/useTool` |
| Tool result history (IndexedDB) | `@/lib/indexeddb/workspace-db` |
| Workspace state (canvas) | `@/lib/indexeddb/workspace-db` |

---

## Security Requirements for AI Tools

All `actions.ts` files in `ai-tools/` MUST:

1. Start with `'use server';`
2. Verify user session before any operation:
   ```ts
   const supabase = await createServerSupabaseClient();
   const { data: { user }, error } = await supabase.auth.getUser();
   if (error || !user) throw new Error('Unauthorized');
   ```
3. Call `deductCreditsForFeature(user.id, featureSlug)` BEFORE calling the AI API
4. Refund credits if the AI call fails (call your refund RPC)
5. Validate all file uploads: MIME type, size, no path traversal
6. Never log user file content or prompts

<!-- TODO(security): Add rate limiting at the API route level — recommend @upstash/ratelimit -->
