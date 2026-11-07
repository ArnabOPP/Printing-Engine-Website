# Admin login through Firebase

Any number of team members can use Firebase Authentication to sign in at `https://printingengine.in/admin`. Admin permissions are controlled by protected Firestore records, not by email addresses, customer profile fields or local password records.

## One-time server setup

Use the same Firebase project that the website already uses for shopper sign-in.

1. In Firebase Console → Authentication → Sign-in method, enable Email/Password and, if needed, Google. The admin panel supports both.
2. In Project settings → Service accounts, generate a private service-account JSON key. Keep the file private.
3. In Railway Variables, set:

   ```dotenv
   ADMIN_AUTH_PROVIDER=firebase
   FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
   ```

   Add `FIREBASE_SERVICE_ACCOUNT_JSON` as a separate variable whose value is the **entire downloaded JSON**, including its braces and private key. Do not add extra wrapping quotes, paste it in chat, upload it to GitHub, or put it in a frontend variable. Railway supplies it to the backend as an environment variable. Keep access to Railway variables limited to trusted maintainers. The server identity needs Firebase Authentication and Firestore permissions for this project.

4. Remove the temporary `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` variables, if previously added. Clear any custom start command that runs `create-admin.js`; the Dockerfile starts the backend directly.
5. Redeploy the backend and frontend with these code changes.

`FIREBASE_OWNER_UID` is **not used**. There is no single-owner UID restriction.

## Give someone access

1. Open Firebase Console → Authentication → Users.
2. Create the person's email/password user, or select an existing account. Copy its **UID**. Customer accounts can also be granted access this way.
3. Open Firestore Database → Data. Create a collection named **`adminAccess`**.
4. Create a document with the person's **exact Authentication UID as its document ID**. Do not use an auto-generated ID or the email address.
5. Add:

   | Field | Type | Value |
   | --- | --- | --- |
   | `status` | string | `admin` |
   | `name` | string | Person's name (optional) |
   | `email` | string | Person's email (optional, for the team list) |

6. Save. They can sign in at `/admin` using their Firebase email/password or Google account (when the Google provider is enabled).

For your own full-access account, use `status` = **`owner`**. Owners can view the Firebase-managed admin team list and use owner-only operations such as deleting orders. Other admins can manage shop operations. Multiple owners are supported.

Only exact lowercase `admin` and `owner` grant access. Set `status` to **`disabled`**, remove the `status` field, or delete the document to deny access. The next admin API request checks Firestore again, including requests from sessions that were already signed in. Role changes also apply on the next API request; refresh the panel to update navigation.

Do not put the status inside `users/{uid}` or its profile. Shopper documents never grant admin permissions. Edit team access in the Firebase Console; this website deliberately does not expose permission-editing forms.

## Required Firestore rules

Deploy the repository's `firestore.rules` using your Firebase Console Rules editor or the Firebase CLI. **Do not enable public/test-mode rules for adminAccess.** The relevant rule is:

```text
match /adminAccess/{uid} { allow read, write: if false; }
```

The existing default-deny rule also protects this collection. Ensure there is no broader permissive rule such as `match /{document=**} { allow read, write: if true; }`: matching Firestore allow rules are additive. Ordinary signed-in users must not be able to create or edit even their own `adminAccess` record. Firebase Console and the trusted backend Admin SDK can manage/read records while browser access remains denied.

## Sessions and passwords

- The frontend signs in with a separate, memory-only Firebase Auth instance so it does not switch or synchronize the shopper account.
- The backend verifies the Firebase ID token, revocation and recent sign-in before issuing 8-hour HttpOnly cookies. It verifies the Firebase session and reads the UID's Firestore permission record on each request.
- Firebase Authentication handles passwords. Forgot password and My account send Firebase password-reset emails. Resetting/disabling a Firebase Authentication user is checked by the backend's revoked-session verification.
- Signing out clears both admin cookies. A Firebase shopper session alone never opens the admin panel.
- `ADMIN_AUTH_PROVIDER=local` is retained for legacy backend tooling and isolated tests. Use `firebase` in production; the public admin sign-in form uses Firebase.

## Validation

The local suite covers multiple admins, owner restrictions, forged browser roles, missing/disabled/deleted access records, role changes on active sessions, revoked or invalid identities, permission-service outages, mismatched session identities, CSRF guards and logout. Its Firebase SDK calls are mocked; live sign-in still requires your actual service-account configuration, protected Firestore rules, Authentication users and adminAccess records.
