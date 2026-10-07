import { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Mail,
  Send,
  X,
} from 'lucide-react'

import type {
  EmailPreviewBlock as EmailPreviewBlockType,
  InteractionPayload,
} from '../types/agent'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type EmailPreviewBlockProps = {
  block: EmailPreviewBlockType
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}

/* -------------------------------------------------------------------------- */
/* Shared styles                                                              */
/* -------------------------------------------------------------------------- */

const styles = {
  text: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
}

/* -------------------------------------------------------------------------- */
/* Email Metadata                                                             */
/* -------------------------------------------------------------------------- */

function EmailMetadata({
  to,
  subject,
}: {
  to: string | string[]
  subject: string
}) {
  const recipients = Array.isArray(to) ? to.join(', ') : to

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      <MetadataRow label="To" value={recipients} mono />
      <MetadataRow label="Subject" value={subject} />
    </div>
  )
}

function MetadataRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span
        style={styles.text}
        className="w-16 shrink-0 text-[12px] font-semibold uppercase tracking-wide text-slate-400"
      >
        {label}
      </span>

      <span
        style={styles.text}
        className={[
          'min-w-0 break-words text-[14px] leading-[1.5] text-slate-700',
          mono ? 'font-mono text-[13px]' : 'font-medium',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function EmailPreviewHeader({
  type,
  to,
  subject,
}: {
  type?: string
  to: string | string[]
  subject: string
}) {
  return (
    <header className="bg-white">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
            <Mail size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <h3
              style={styles.text}
              className="truncate text-[14px] font-semibold leading-[1.35] text-slate-900"
            >
              Email draft
            </h3>

            <p
              style={styles.text}
              className="mt-0.5 text-[12px] leading-[1.35] text-slate-500"
            >
              Review before sending
            </p>
          </div>
        </div>

        <span
          style={styles.text}
          className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          {type || 'custom'}
        </span>
      </div>

      <EmailMetadata to={to} subject={subject} />
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* Email Frame                                                                */
/* -------------------------------------------------------------------------- */

function EmailFrame({ html }: { html?: string }) {
  const sanitizedHtml = html
    ? html.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        '',
      )
    : '<p>No content</p>'

  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          body {
            padding: 24px;
            color: #1e293b;
            font-family:
              "Helvetica Neue",
              Helvetica,
              Arial,
              sans-serif;
            font-size: 14px;
            line-height: 1.5;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          table {
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        ${sanitizedHtml}
      </body>
    </html>
  `

  return (
    <section className="border-t border-slate-100 bg-slate-50/70 p-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex h-8 items-center gap-1 border-b border-slate-100 bg-slate-50 px-3">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />

          <span
            style={styles.text}
            className="ml-2 text-[11px] font-medium text-slate-400"
          >
            Email preview
          </span>
        </div>

        <iframe
          title="Email Preview"
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          className="block h-[420px] w-full border-0 bg-white"
        />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Action Status                                                              */
/* -------------------------------------------------------------------------- */

function EmailActionStatus({
  action,
  feedback,
}: {
  action?: string
  feedback?: string
}) {
  if (action === 'approve') {
    return (
      <StatusMessage
        icon={<Check size={15} />}
        title="Email approved"
        description="The draft has been queued for delivery."
        tone="success"
      />
    )
  }

  if (action === 'reject') {
    return (
      <StatusMessage
        icon={<X size={15} />}
        title="Email rejected"
        description="The draft will not be sent."
        tone="danger"
      />
    )
  }

  if (action === 'change') {
    return (
      <StatusMessage
        icon={<Edit3 size={15} />}
        title="Changes requested"
        description={feedback || 'The assistant is revising the draft.'}
        tone="warning"
      />
    )
  }

  return null
}

function StatusMessage({
  icon,
  title,
  description,
  tone,
}: {
  icon: React.ReactNode
  title: string
  description: string
  tone: 'success' | 'danger' | 'warning'
}) {
  const toneStyles = {
    success: {
      container: 'border-emerald-200 bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-600',
      title: 'text-emerald-800',
      description: 'text-emerald-700',
    },
    danger: {
      container: 'border-rose-200 bg-rose-50',
      icon: 'bg-rose-100 text-rose-600',
      title: 'text-rose-800',
      description: 'text-rose-700',
    },
    warning: {
      container: 'border-amber-200 bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      title: 'text-amber-800',
      description: 'text-amber-700',
    },
  }

  const current = toneStyles[tone]

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${current.container}`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${current.icon}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p
          style={styles.text}
          className={`text-[13px] font-semibold ${current.title}`}
        >
          {title}
        </p>

        <p
          style={styles.text}
          className={`mt-0.5 text-[12px] leading-[1.45] ${current.description}`}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Change Form                                                                */
/* -------------------------------------------------------------------------- */

function EmailChangeForm({
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const disabled = !value.trim()

  return (
    <div className="space-y-3">
      <div>
        <label
          style={styles.text}
          className="text-[13px] font-semibold text-slate-800"
        >
          What should be changed?
        </label>

        <p
          style={styles.text}
          className="mt-1 text-[12px] leading-[1.45] text-slate-500"
        >
          Tell the assistant what you want modified in the email.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Make the tone more formal and mention the 10% discount."
        rows={4}
        autoFocus
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-[1.5] text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        style={styles.text}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          style={styles.text}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          style={styles.text}
        >
          <Send size={14} />
          Submit changes
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Approval Actions                                                           */
/* -------------------------------------------------------------------------- */

function EmailApprovalActions({
  onApprove,
  onReject,
  onRequestChange,
}: {
  onApprove: () => void
  onReject: () => void
  onRequestChange: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          style={styles.text}
        >
          <Check size={15} />
          Approve & send
        </button>

        <button
          type="button"
          onClick={onReject}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          style={styles.text}
        >
          <X size={14} />
          Reject
        </button>
      </div>

      <button
        type="button"
        onClick={onRequestChange}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        style={styles.text}
      >
        <Edit3 size={14} />
        Request changes
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function EmailPreviewBlock({
  block,
  conversationId,
  onRespond,
}: EmailPreviewBlockProps) {
  const { data, answered, actionTaken, feedback: existingFeedback } = block

  const [isRequestingChange, setIsRequestingChange] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const respond = (
    action: 'approve' | 'reject' | 'change',
    feedback?: string,
  ) => {
    onRespond({
      conversationId,
      draftId: data.draftId,
      response: {
        type: 'option',
        value: {
          action,
          ...(feedback ? { feedback } : {}),
        },
      },
    })
  }

  const handleSubmitChange = () => {
    const feedback = feedbackText.trim()

    if (!feedback) return

    respond('change', feedback)

    setFeedbackText('')
    setIsRequestingChange(false)
  }

  return (
    <article
      style={styles.text}
      className="my-5 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <EmailPreviewHeader
        type={data.type}
        to={data.to}
        subject={data.subject}
      />

      <EmailFrame html={data.html} />

      <footer className="border-t border-slate-100 bg-white p-5">
        {answered ? (
          <EmailActionStatus
            action={actionTaken}
            feedback={existingFeedback}
          />
        ) : isRequestingChange ? (
          <EmailChangeForm
            value={feedbackText}
            onChange={setFeedbackText}
            onCancel={() => {
              setFeedbackText('')
              setIsRequestingChange(false)
            }}
            onSubmit={handleSubmitChange}
          />
        ) : (
          <EmailApprovalActions
            onApprove={() => respond('approve')}
            onReject={() => respond('reject')}
            onRequestChange={() => setIsRequestingChange(true)}
          />
        )}
      </footer>
    </article>
  )
}