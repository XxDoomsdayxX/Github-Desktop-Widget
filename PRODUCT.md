# Product

## Register

product

## Users

Software developers who manage multiple GitHub repositories. They work across one or two monitors with VS Code, GitHub Desktop, or a terminal open, and want to know at a glance whether a repo is ahead of their local state before they start coding. The widget lives persistently on the desktop, not opened and closed like an app.

## Product Purpose

A floating, draggable desktop widget that monitors selected GitHub repositories and signals sync status at a glance. Green: local is current. Red: changes exist on remote that haven't been pulled. Each repo entry shows a status indicator, the last committer's name, the short commit hash, and the commit message. The product removes the friction of opening GitHub or running git status just to know whether a pull is needed.

## Brand Personality

Precise, polished, unobtrusive. The widget earns a permanent spot on the desktop by being fast to read and never demanding attention it hasn't earned. Stylish means refined details, not decoration.

## Anti-references

- Windows Vista/7 sidebar gadgets: plasticky, skeuomorphic, heavy chrome
- Generic SaaS dashboards: padded cards, hero metrics, excessive structure
- Rainmeter/gamer widgets: neon, over-designed, attention-seeking
- GitHub's own UI: web-app layout patterns crammed into a small surface

## Design Principles

1. One glance, one answer. Status must be readable before focus fully lands on it.
2. Earn the pixel. At this scale, every element must justify its presence.
3. Quiet professionalism. The widget should look like it belongs in a premium developer setup.
4. Size is a feature. Smallness is a design constraint, not a limitation to design around.

## Accessibility & Inclusion

WCAG AA minimum. Status must not rely on color alone; the indicator should have a secondary signal (shape or label) beyond green/red. Support system font scaling where applicable.
