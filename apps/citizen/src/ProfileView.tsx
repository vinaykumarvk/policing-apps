import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "@puda/shared";

const Onboarding = lazy(() => import("./Onboarding"));
const ProfileSummaryLazy = lazy(() => import("./Onboarding").then((m) => ({ default: m.ProfileSummary })));

type Props = {
  profileApplicant: Record<string, any>;
  profileAddresses: Record<string, any>;
  profileVerification: Record<string, any>;
  profileCompleteness: any;
  onProfileUpdate: (section: string) => void;
  onProfileComplete: (data: any) => void;
  onProfileSkip: () => void;
  onReVerifyAadhaar: () => void;
  onReVerifyPan: () => void;
};

export default function ProfileView({
  profileApplicant,
  profileAddresses,
  profileVerification,
  profileCompleteness,
  onProfileUpdate,
  onProfileComplete,
  onProfileSkip,
  onReVerifyAadhaar,
  onReVerifyPan,
}: Props) {
  const { t } = useTranslation();

  const hasProfileData = Boolean(
    profileApplicant.full_name || profileApplicant.first_name ||
    profileApplicant.aadhaar || profileApplicant.email
  );
  const showProfileView = Boolean(profileVerification.onboarding_completed_at) || hasProfileData;

  return (
    <div className="page">
      <a href="#citizen-main-profile" className="skip-link">{t("common.skip_to_main")}</a>
      <h1>{showProfileView ? t("nav.profile") : t("profile.complete_profile")}</h1>
      {!showProfileView && <p className="subtitle">{t("profile.complete_subtitle")}</p>}
      <main id="citizen-main-profile" className="panel" role="main">
        <Suspense fallback={<div style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="2rem" width="50%" /><SkeletonBlock height="4rem" /><SkeletonBlock height="4rem" /></div>}>
          {showProfileView ? (
            <ProfileSummaryLazy
              applicant={profileApplicant}
              addresses={profileAddresses}
              verification={profileVerification}
              completeness={profileCompleteness}
              onUpdate={onProfileUpdate}
              onReVerifyAadhaar={onReVerifyAadhaar}
              onReVerifyPan={onReVerifyPan}
            />
          ) : (
            <Onboarding
              applicant={profileApplicant}
              addresses={profileAddresses}
              verification={profileVerification}
              completeness={profileCompleteness}
              onComplete={onProfileComplete}
              onSkip={onProfileSkip}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
