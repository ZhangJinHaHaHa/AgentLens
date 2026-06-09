import { useEffect, useMemo, useState, type TextareaHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, RefreshCw, ShieldCheck, Star, Wallet } from "lucide-react";

import reviewArtifact from "../../../../contracts/artifacts/AgentReviewRegistry.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppConfig } from "@/config/appConfig";
import { useWallet } from "@/hooks/useWallet";
import { formatPriceEth, truncateAddress } from "@/lib/format";
import { createReviewClient, type RatingDistribution } from "@/lib/reviewClient";
import { rentAgent } from "@/lib/marketplaceWriteClient";
import {
  submitReview as submitReviewTx,
  type SixDimensionalRatings
} from "@/lib/reviewWriteClient";
import type { MarketplaceClient } from "@/lib/marketplaceClient";
import { cn } from "@/lib/utils";

interface NativeMarketplaceActionsProps {
  config: AppConfig;
  tokenId: bigint;
  marketplaceClient: MarketplaceClient | null;
  pricing: {
    pricePerDay: bigint;
    buyPrice: bigint;
    configured: boolean;
  } | null;
}

interface AccessState {
  status: "unavailable" | "loading" | "ready" | "error";
  hasAccess: boolean;
  hasReviewed: boolean;
  reviewCount: number | null;
  ratingDistribution: RatingDistribution | null;
  errorMessage: string | null;
}

const DIMENSIONS = [
  "security",
  "taskExecution",
  "cognitive",
  "environment",
  "engineering",
  "compliance"
] as const;

const RATING_OPTIONS = [
  { value: 0, key: "bad" },
  { value: 1, key: "neutral" },
  { value: 2, key: "good" }
] as const;

export function NativeMarketplaceActions({
  config,
  tokenId,
  marketplaceClient,
  pricing
}: NativeMarketplaceActionsProps): JSX.Element {
  const { t } = useTranslation("detail");
  const wallet = useWallet();
  const [durationDays, setDurationDays] = useState(7);
  const [ratings, setRatings] = useState<SixDimensionalRatings>([2, 2, 2, 2, 2, 2]);
  const [commentText, setCommentText] = useState("");
  const [accessState, setAccessState] = useState<AccessState>({
    status: marketplaceClient ? "loading" : "unavailable",
    hasAccess: false,
    hasReviewed: false,
    reviewCount: null,
    ratingDistribution: null,
    errorMessage: null
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRenting, setIsRenting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rentalTxHash, setRentalTxHash] = useState<string | null>(null);
  const [reviewTxHash, setReviewTxHash] = useState<string | null>(null);
  const [lastCommentHash, setLastCommentHash] = useState<string | null>(null);

  const reviewClient = useMemo(() => {
    if (!config.reviewRegistryAddress) return null;
    return createReviewClient(
      config.reviewRegistryAddress,
      reviewArtifact.abi,
      config.rpcUrl,
      config.chainId
    );
  }, [config.chainId, config.reviewRegistryAddress, config.rpcUrl]);

  useEffect(() => {
    if (!marketplaceClient || wallet.status !== "connected" || !wallet.address) {
      setAccessState({
        status: marketplaceClient ? "unavailable" : "unavailable",
        hasAccess: false,
        hasReviewed: false,
        reviewCount: null,
        ratingDistribution: null,
        errorMessage: null
      });
      return;
    }

    let cancelled = false;
    setAccessState((current) => ({ ...current, status: "loading", errorMessage: null }));

    async function load(): Promise<void> {
      const hasAccess = await marketplaceClient!.hasAccess(tokenId, wallet.address!);
      const reviewResults = reviewClient
        ? await Promise.allSettled([
            reviewClient.hasReviewed(tokenId, wallet.address!),
            reviewClient.getReviewCount(tokenId),
            reviewClient.getRatingDistribution(tokenId)
          ])
        : null;

      if (cancelled) return;

      setAccessState({
        status: "ready",
        hasAccess,
        hasReviewed:
          reviewResults?.[0].status === "fulfilled" ? reviewResults[0].value : false,
        reviewCount:
          reviewResults?.[1].status === "fulfilled" ? Number(reviewResults[1].value) : null,
        ratingDistribution:
          reviewResults?.[2].status === "fulfilled" ? reviewResults[2].value : null,
        errorMessage: null
      });
    }

    void load().catch((error) => {
      if (!cancelled) {
        setAccessState({
          status: "error",
          hasAccess: false,
          hasReviewed: false,
          reviewCount: null,
          ratingDistribution: null,
          errorMessage: error instanceof Error ? error.message : t("nativeChain.marketplace.errors.loadAccess")
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [marketplaceClient, refreshNonce, reviewClient, t, tokenId, wallet.address, wallet.status]);

  const chainMatches = wallet.chainId === config.chainId;
  const durationValid = Number.isInteger(durationDays) && durationDays > 0 && durationDays <= 365;
  const rentalConfigured = Boolean(config.marketplaceAddress && pricing?.configured && pricing.pricePerDay >= 0n);
  const rentalTotal = rentalConfigured && durationValid && pricing
    ? pricing.pricePerDay * BigInt(durationDays)
    : null;
  const canRent =
    rentalConfigured &&
    durationValid &&
    wallet.status === "connected" &&
    chainMatches &&
    !isRenting;
  const canReview =
    Boolean(config.reviewRegistryAddress) &&
    accessState.hasAccess &&
    !accessState.hasReviewed &&
    wallet.status === "connected" &&
    chainMatches &&
    !isReviewing;

  async function submitRental(): Promise<void> {
    setActionError(null);
    setRentalTxHash(null);

    if (wallet.status !== "connected") {
      await wallet.connect();
      return;
    }
    if (!chainMatches) {
      setActionError(t("nativeChain.marketplace.errors.chainMismatch", {
        current: wallet.chainId ?? "unknown",
        expected: config.chainId
      }));
      return;
    }
    if (!config.marketplaceAddress || !pricing?.configured || rentalTotal === null) {
      setActionError(t("nativeChain.marketplace.errors.pricingMissing"));
      return;
    }

    setIsRenting(true);
    try {
      const signer = await wallet.getSigner();
      const result = await rentAgent({
        marketplaceAddress: config.marketplaceAddress,
        signer,
        tokenId,
        durationDays,
        valueWei: rentalTotal
      });
      setRentalTxHash(result.hash);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("nativeChain.marketplace.errors.rentalFailed"));
    } finally {
      setIsRenting(false);
    }
  }

  async function submitReview(): Promise<void> {
    setActionError(null);
    setReviewTxHash(null);
    setLastCommentHash(null);

    if (wallet.status !== "connected") {
      await wallet.connect();
      return;
    }
    if (!chainMatches) {
      setActionError(t("nativeChain.marketplace.errors.chainMismatch", {
        current: wallet.chainId ?? "unknown",
        expected: config.chainId
      }));
      return;
    }
    if (!config.reviewRegistryAddress) {
      setActionError(t("nativeChain.marketplace.errors.reviewRegistryMissing"));
      return;
    }
    if (!accessState.hasAccess) {
      setActionError(t("nativeChain.marketplace.errors.accessRequired"));
      return;
    }

    setIsReviewing(true);
    try {
      const signer = await wallet.getSigner();
      const result = await submitReviewTx({
        reviewRegistryAddress: config.reviewRegistryAddress,
        signer,
        tokenId,
        ratings,
        commentText
      });
      setReviewTxHash(result.hash);
      setLastCommentHash(result.commentHash);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("nativeChain.marketplace.errors.reviewFailed"));
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {t("nativeChain.marketplace.title")}
        </CardTitle>
        <CardDescription>
          {t("nativeChain.marketplace.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={wallet.status === "connected" ? "success" : "secondary"}>
            {wallet.status === "connected" && wallet.address
              ? t("nativeChain.marketplace.walletConnected", { address: truncateAddress(wallet.address) })
              : t("nativeChain.marketplace.walletNotConnected")}
          </Badge>
          <Badge variant={chainMatches ? "success" : "warning"}>
            {wallet.chainId
              ? t("nativeChain.marketplace.chain", { chainId: wallet.chainId })
              : t("nativeChain.marketplace.expectedChain", { chainId: config.chainId })}
          </Badge>
          <Badge variant={accessState.hasAccess ? "success" : "secondary"}>
            {accessState.hasAccess ? t("nativeChain.marketplace.activeAccess") : t("nativeChain.marketplace.noActiveAccess")}
          </Badge>
          {accessState.hasReviewed ? <Badge variant="secondary">{t("nativeChain.marketplace.reviewed")}</Badge> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={accessState.status === "loading"}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", accessState.status === "loading" && "animate-spin")} aria-hidden />
            {t("nativeChain.marketplace.refresh")}
          </Button>
        </div>

        {accessState.errorMessage ? <p className="text-sm text-danger">{accessState.errorMessage}</p> : null}
        {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
        {wallet.status !== "connected" ? (
          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            onClick={() => void wallet.connect()}
            disabled={wallet.status === "connecting" || wallet.status === "unavailable"}
          >
            <Wallet className="h-4 w-4" aria-hidden />
            {wallet.status === "connecting" ? t("nativeChain.marketplace.connecting") : t("nativeChain.marketplace.connect")}
          </Button>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{t("nativeChain.marketplace.rentTitle")}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{t("nativeChain.marketplace.rentDescription")}</p>
              </div>
              <Badge variant={rentalConfigured ? "success" : "secondary"}>
                {rentalConfigured ? t("nativeChain.marketplace.configured") : t("nativeChain.marketplace.notConfigured")}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`rent-duration-${String(tokenId)}`}>{t("nativeChain.marketplace.durationDays")}</Label>
                <Input
                  id={`rent-duration-${String(tokenId)}`}
                  type="number"
                  min={1}
                  max={365}
                  value={String(durationDays)}
                  onChange={(event) => setDurationDays(parseDuration(event.target.value))}
                />
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("nativeChain.marketplace.rentPerDay")}</span>
                  <span>{pricing?.configured ? formatPriceEth(pricing.pricePerDay) : t("nativeChain.notSet")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("nativeChain.marketplace.total")}</span>
                  <span>{rentalTotal !== null ? formatPriceEth(rentalTotal) : "—"}</span>
                </div>
              </div>
              {wallet.status === "connected" && !chainMatches ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void wallet.switchChain(config.chainId).catch((error) => {
                    setActionError(error instanceof Error ? error.message : t("nativeChain.marketplace.errors.switchChain"));
                  })}
                >
                  {t("nativeChain.marketplace.switchChain", { chainId: config.chainId })}
                </Button>
              ) : null}
              <Button type="button" onClick={() => void submitRental()} disabled={!canRent}>
                <Wallet className="h-4 w-4" aria-hidden />
                {isRenting ? t("nativeChain.marketplace.renting") : t("nativeChain.marketplace.rentAgent")}
              </Button>
              {rentalTxHash ? <SuccessLine label={t("nativeChain.marketplace.rentalTx")} value={rentalTxHash} /> : null}
            </div>
          </section>

          <section className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{t("nativeChain.marketplace.reviewTitle")}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{t("nativeChain.marketplace.reviewDescription")}</p>
              </div>
              <Badge variant={config.reviewRegistryAddress ? "success" : "secondary"}>
                {config.reviewRegistryAddress
                  ? t("nativeChain.marketplace.reviews", { count: accessState.reviewCount ?? 0 })
                  : t("nativeChain.marketplace.notConfigured")}
              </Badge>
            </div>

            {accessState.ratingDistribution ? (
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                {DIMENSIONS.map((dimension, index) => (
                  <div key={dimension} className="flex items-center justify-between gap-2">
                    <span>{t(`nativeChain.dimensions.${dimension}`)}</span>
                    <span>{t("nativeChain.marketplace.goodRatio", { ratio: formatGoodRatio(accessState.ratingDistribution!, index) })}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              {DIMENSIONS.map((dimension, index) => (
                <div key={dimension} className="grid gap-2">
                  <Label>{t(`nativeChain.dimensions.${dimension}`)}</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-1">
                    {RATING_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={ratings[index] === option.value ? "default" : "ghost"}
                        onClick={() => updateRating(setRatings, index, option.value)}
                      >
                        {t(`nativeChain.marketplace.${option.key}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid gap-2">
                <Label htmlFor={`review-comment-${String(tokenId)}`}>{t("nativeChain.marketplace.offChainComment")}</Label>
                <Textarea
                  id={`review-comment-${String(tokenId)}`}
                  value={commentText}
                  placeholder={t("nativeChain.marketplace.commentPlaceholder")}
                  onChange={(event) => setCommentText(event.target.value)}
                />
              </div>
              <Button type="button" onClick={() => void submitReview()} disabled={!canReview}>
                <Star className="h-4 w-4" aria-hidden />
                {isReviewing ? t("nativeChain.marketplace.submittingReview") : t("nativeChain.marketplace.submitReview")}
              </Button>
              {accessState.hasReviewed ? (
                <p className="text-sm text-muted-foreground">{t("nativeChain.marketplace.alreadyReviewed")}</p>
              ) : null}
              {reviewTxHash ? <SuccessLine label={t("nativeChain.marketplace.reviewTx")} value={reviewTxHash} /> : null}
              {lastCommentHash ? <SuccessLine label={t("nativeChain.marketplace.commentHash")} value={lastCommentHash} /> : null}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    />
  );
}

function SuccessLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-success/40 bg-success/5 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
        {label}
      </div>
      <p className="mt-1 break-all text-muted-foreground">{value}</p>
    </div>
  );
}

function parseDuration(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(365, parsed));
}

function updateRating(
  setRatings: (updater: (current: SixDimensionalRatings) => SixDimensionalRatings) => void,
  index: number,
  rating: number
): void {
  setRatings((current) => current.map((value, idx) => (idx === index ? rating : value)) as SixDimensionalRatings);
}

function formatGoodRatio(distribution: RatingDistribution, index: number): string {
  const bps = distribution.goodRatios[index] ?? 0;
  return `${Math.round(bps / 100)}%`;
}
