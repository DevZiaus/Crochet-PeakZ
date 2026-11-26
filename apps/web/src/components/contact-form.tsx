"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGE_MAX,
  CONTACT_MESSAGE_MIN,
  CONTACT_NAME_MAX,
  CONTACT_TOPICS,
  CONTACT_TOPIC_KEYS,
  contactSubmissionSchema,
  type ContactTopic,
} from "@crochet-peakz/shared";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldName = "name" | "email" | "topic" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

interface ApiErrorPayload {
  error?:
    | string
    | {
        message?: string;
        details?: {
          issues?: Array<{ path?: string; message?: string }>;
        };
      };
}

function isFieldName(value: string): value is FieldName {
  return (
    value === "name" ||
    value === "email" ||
    value === "topic" ||
    value === "message"
  );
}

/** Props for {@link ContactForm}. */
export interface ContactFormProps {
  /** Optional topic pre-selected on initial load. */
  initialTopic?: ContactTopic;
}

/**
 * Interactive storefront contact form with client-side Zod validation,
 * honeypot and fill-time bot guards, accessible field wiring, and inline
 * delivery feedback.
 */
export function ContactForm({ initialTopic }: ContactFormProps = {}) {
  const defaultTopic: ContactTopic = initialTopic ?? "general";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadedAtRef = useRef<number>(0);

  useEffect(() => {
    loadedAtRef.current = Date.now();
  }, []);

  function clearFieldError(field: FieldName) {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      return { ...prev, [field]: undefined };
    });
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitted(null);

    const elapsedMs =
      loadedAtRef.current > 0 ? Date.now() - loadedAtRef.current : 0;

    const parsed = contactSubmissionSchema.safeParse({
      name,
      email,
      topic,
      message,
      website,
      elapsedMs,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      let generalError: string | null = null;

      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (isFieldName(key)) {
          if (!nextErrors[key]) {
            nextErrors[key] = issue.message;
          }
        } else if (!generalError) {
          generalError = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      if (generalError) {
        setError(generalError);
      }
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        let payload: ApiErrorPayload | null = null;
        try {
          payload = (await response.json()) as ApiErrorPayload;
        } catch {
          payload = null;
        }

        const nextFieldErrors: FieldErrors = {};
        let messageText =
          "We could not send your message right now. Please try again in a moment.";

        if (typeof payload?.error === "string") {
          messageText = payload.error;
        } else if (payload?.error) {
          if (payload.error.message) {
            messageText = payload.error.message;
          }
          for (const issue of payload.error.details?.issues ?? []) {
            if (
              issue.path &&
              issue.message &&
              isFieldName(issue.path) &&
              !nextFieldErrors[issue.path]
            ) {
              nextFieldErrors[issue.path] = issue.message;
            }
          }
        }

        setFieldErrors(nextFieldErrors);
        setError(messageText);
        return;
      }

      setName("");
      setEmail("");
      setTopic(defaultTopic);
      setMessage("");
      setWebsite("");
      setFieldErrors({});
      loadedAtRef.current = Date.now();
      setSubmitted(
        "Thank you for reaching out. Your message is on its way and we will reply soon.",
      );
    } catch {
      setError(
        "We could not send your message right now. Please check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const topicDescribedBy = fieldErrors.topic
    ? "contact-topic-error"
    : undefined;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <h2 className="font-heading text-2xl font-bold leading-none tracking-tight text-foreground">
          Send us a note
        </h2>
        <CardDescription>
          Tell us about a custom idea, a pattern question, or an existing order.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {submitted ? <FormAlert tone="success">{submitted}</FormAlert> : null}
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}

        <form
          className="relative space-y-5"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          noValidate
        >
          <div
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              label="Name"
              htmlFor="contact-name"
              required
              error={fieldErrors.name}
            >
              <Input
                name="name"
                autoComplete="name"
                placeholder="Your name"
                maxLength={CONTACT_NAME_MAX}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
                required
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="contact-email"
              required
              error={fieldErrors.email}
            >
              <Input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                maxLength={CONTACT_EMAIL_MAX}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                required
              />
            </FormField>
          </div>

          <FormField
            label="Topic"
            htmlFor="contact-topic"
            required
            error={fieldErrors.topic}
          >
            <>
              <Select
                value={topic}
                onValueChange={(value) => {
                  setTopic(value as ContactTopic);
                  clearFieldError("topic");
                }}
              >
                <SelectTrigger
                  id="contact-topic"
                  className="w-full"
                  aria-required="true"
                  aria-invalid={fieldErrors.topic ? true : undefined}
                  aria-describedby={topicDescribedBy}
                >
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TOPIC_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CONTACT_TOPICS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          </FormField>

          <FormField
            label="Message"
            htmlFor="contact-message"
            description={`Between ${String(CONTACT_MESSAGE_MIN)} and ${String(CONTACT_MESSAGE_MAX)} characters.`}
            required
            error={fieldErrors.message}
          >
            <Textarea
              name="message"
              rows={5}
              maxLength={CONTACT_MESSAGE_MAX}
              placeholder="Share a few details about what you have in mind…"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                clearFieldError("message");
              }}
              required
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending message…" : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
