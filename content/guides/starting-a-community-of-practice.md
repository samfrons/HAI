---
id: starting-a-community-of-practice
title: Starting an AI Community of Practice
skill_levels: [beginner, intermediate]
summary: A practical guide to building adoption through champions, prompt-sharing, and office hours — and feeding real use cases back into engineering priorities.
---

# Starting an AI Community of Practice

Rolling out a tool like HAI doesn't end at the training session. Adoption happens in the weeks after, in the small moments where someone is stuck on a report and doesn't know whether AI could help, or tries it once, gets a mediocre result, and quietly stops. A community of practice is how you catch those moments instead of losing them.

## The champions model

Pick 3–6 people across roles — not necessarily the most technical staff, but the ones colleagues already ask for help. A program officer who's genuinely curious and vocal about what worked (and what didn't) does more for adoption than a technical expert who finds the tool obvious and can't articulate why others find it hard.

Champions' job is small and concrete: use the tool visibly in their own work, answer questions when a colleague gets stuck, and bring back what they're seeing — good and bad — to the group running this community of practice. It's not a training role and shouldn't be treated as extra unpaid work; budget a modest, explicit time allowance (an hour or two a week) so it doesn't quietly compete with their actual job.

## Prompt-sharing rituals

The single highest-leverage habit is a shared, low-friction place to post prompts that worked — a channel, a shared doc, whatever your organization already uses for this kind of thing. The habit matters more than the tool. A simple format keeps it useful:

- The prompt itself
- What it was for
- What made it work (specific to your context, cited a source, restricted to provided data, etc.)

This does two things at once: it gives newer users a library of starting points instead of a blank page, and it surfaces, over time, which kinds of tasks the tool handles well versus poorly in your organization's actual work — which feeds directly into the feedback loop below.

## Office hours

A recurring, short, drop-in session — 30 minutes, same time every week or two — where anyone can bring a real task and work through it live with a champion. Two things make office hours work:

- **Keep it task-based, not lecture-based.** People show up with an actual report or proposal they're stuck on, not to hear a refresher presentation.
- **Protect it from becoming an escalation queue for tool bugs.** Office hours are for "how do I prompt this well," not "the tool is broken" — route the latter to whoever owns the engineering side, and say so explicitly so people don't lose confidence in the session when a bug shows up.

## Measuring adoption: leading indicators, not vanity metrics

Total query volume looks good on a slide and tells you almost nothing about whether adoption is actually taking hold. Watch these instead:

- **Breadth, not just volume**: how many distinct roles and teams are using it regularly, not just how many queries one enthusiastic person is running.
- **Return usage**: are people coming back to it for a second and third task, or trying it once and stopping? A drop-off after one use is a stronger signal than low volume.
- **Prompt-sharing participation**: are people other than the champions contributing to the shared prompt library? That's a sign the tool has become part of normal workflow, not a champion-only novelty.
- **Unprompted requests for access or training**: someone from a team you haven't onboarded yet asking to join is worth more than a dozen queries from a team that's already in.

Vanity metrics to be skeptical of: raw query counts, "percentage of staff who attended a training," or any number that goes up just because you told people to use the tool for a week.

## The feedback loop: onboarding versus custom build

Not every use case that comes up in office hours or the prompt-sharing channel is done being served by prompting alone. Some of them are the same request showing up over and over, in a form specific enough that it's worth engineering time to build a dedicated feature or tool integration instead of asking every user to reconstruct the same careful prompt from scratch.

The signal to watch for is repetition with friction: the same task, requested by multiple people, that consistently needs a long or fragile prompt to get right. When you see that pattern, that's the case to escalate to whoever owns HAI's engineering roadmap — not every good prompt, just the ones enough people need often enough that a purpose-built tool would clearly beat teaching everyone the workaround.

Keep this loop visible: when a use case does get escalated and built, say so back to the community of practice. It closes the loop for the people who raised it, and it reinforces that office hours and prompt-sharing aren't just training exercises — they're a real input into what gets built next.
