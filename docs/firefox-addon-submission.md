# Firefox Add-on Submission Notes

Use this text when submitting CareerOS Capture to addons.mozilla.org.

## Version Notes

CareerOS Capture 1.0.0 is the initial Firefox release. It lets signed-in CareerOS users detect job posts on supported job boards, review the captured job details, and save them into their CareerOS workspace. This version includes cross-browser support for LinkedIn, Indeed, and Naukri job pages, Firefox-compatible authentication/storage handling, and the required Firefox data collection disclosure for job-page capture and CareerOS account authentication.

## Notes To Reviewer

CareerOS Capture requires a CareerOS account to fully test saving/importing jobs.

Test account:

- Email: [paste dedicated reviewer test email here]
- Password: [paste dedicated reviewer test password here]

Testing steps:

1. Install the extension.
2. Open the extension popup and sign in with the test account.
3. Visit a public job detail page on LinkedIn, Indeed, or Naukri.
4. Confirm that the CareerOS detection prompt appears only after sign-in.
5. Save/import the detected job from the prompt or extension popup.
6. Confirm the extension reports a successful import.

The extension does not execute remote code. It only sends authenticated API requests to CareerOS/Firebase and supported identity endpoints for login, token refresh, and saving detected job details.
