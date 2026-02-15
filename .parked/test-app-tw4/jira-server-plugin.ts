/**
 * Vite plugin that adds server-side Jira API endpoints.
 * This replicates the pattern used in Next.js API routes —
 * the browser never talks to Jira directly; Node.js does.
 */
import type { Plugin } from 'vite'

function toBasicAuth(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

async function readBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function jiraServerPlugin(): Plugin {
  let jiraBaseUrl = ''
  let jiraEmail = ''
  let jiraApiToken = ''

  return {
    name: 'jira-server-endpoints',

    configResolved(config) {
      // Access env vars that Vite loaded from .env files
      const env = config.env ?? {}
      jiraBaseUrl = (env.VITE_JIRA_BASE_URL ?? '').replace(/\/$/, '')
      jiraEmail = env.VITE_JIRA_EMAIL ?? ''
      jiraApiToken = env.VITE_JIRA_API_TOKEN ?? ''
    },

    configureServer(server) {
      // POST /api/jira/create-issue  — server-side issue creation
      server.middlewares.use('/api/jira/create-issue', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const body = JSON.parse((await readBody(req)).toString())
          const { summary, description, issueType, projectKey } = body

          // Build ADF description
          const paragraphs = description
            .split(/\n{2,}/)
            .map((chunk: string) => chunk.trim())
            .filter(Boolean)
            .map((chunk: string) => ({
              type: 'paragraph',
              content: [{ type: 'text', text: chunk }],
            }))

          const adf = { type: 'doc', version: 1, content: paragraphs }

          const jiraRes = await fetch(`${jiraBaseUrl}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
              Authorization: toBasicAuth(jiraEmail, jiraApiToken),
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              fields: {
                project: { key: projectKey },
                summary,
                description: adf,
                issuetype: { name: issueType || 'Bug' },
              },
            }),
          })

          const data = await jiraRes.json().catch(() => null) as any
          if (!jiraRes.ok) {
            console.error('[jira-plugin] create-issue failed:', jiraRes.status, JSON.stringify(data))
            res.statusCode = jiraRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: data?.errorMessages?.join('; ') || `Jira returned ${jiraRes.status}` }))
            return
          }

          res.statusCode = 201
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            id: data.id,
            key: data.key,
            url: `${jiraBaseUrl}/browse/${data.key}`,
          }))
        } catch (err: any) {
          console.error('[jira-plugin] create-issue error:', err.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })

      // POST /api/jira/upload-attachment  — server-side file upload
      server.middlewares.use('/api/jira/upload-attachment', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const rawBody = await readBody(req)
          const contentType = req.headers['content-type'] || ''

          // Parse multipart boundary
          const boundaryMatch = contentType.match(/boundary=(.+)/)
          if (!boundaryMatch) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing multipart boundary' }))
            return
          }

          // Use the Web API Request to parse FormData
          const webReq = new Request('http://localhost/upload', {
            method: 'POST',
            headers: { 'Content-Type': contentType },
            body: new Uint8Array(rawBody),
          })

          const formData = await webReq.formData()
          const issueKey = formData.get('issueKey') as string
          const file = formData.get('file') as File

          if (!issueKey || !file) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing issueKey or file' }))
            return
          }

          // Re-create FormData for Jira
          const jiraForm = new FormData()
          jiraForm.append('file', file, file.name)

          const jiraRes = await fetch(
            `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/attachments`,
            {
              method: 'POST',
              headers: {
                Authorization: toBasicAuth(jiraEmail, jiraApiToken),
                Accept: 'application/json',
                'X-Atlassian-Token': 'no-check',
              },
              body: jiraForm,
            },
          )

          if (!jiraRes.ok) {
            const data = await jiraRes.json().catch(() => null) as any
            console.error('[jira-plugin] upload failed:', jiraRes.status, JSON.stringify(data))
            res.statusCode = jiraRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: data?.errorMessages?.join('; ') || `Upload failed (${jiraRes.status})` }))
            return
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (err: any) {
          console.error('[jira-plugin] upload error:', err.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}
