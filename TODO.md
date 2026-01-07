# TODO: Switch to Resend API-based Email

## Completed Tasks

- [x] Install 'resend' package via pnpm
- [x] Update `src/utils/email.ts` to use Resend client instead of Nodemailer
- [x] Remove 'nodemailer' and '@types/nodemailer' from package.json

## Remaining Tasks

- [ ] Update environment variables in .env file or documentation:
  - Replace SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM with RESEND_API_KEY and RESEND_FROM
- [ ] Test email functions (password reset, verification, magic link, order ID emails)
- [ ] Update any .env.example or README.md with new environment variable requirements
- [ ] Verify Resend account setup and domain verification if needed

## Notes

- Default 'from' email is set to 'noreply@hudumahub.com' if RESEND_FROM is not provided
- Ensure RESEND_API_KEY is set in production environment
