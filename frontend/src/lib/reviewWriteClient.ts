import { Contract, sha256, toUtf8Bytes, type InterfaceAbi, type JsonRpcSigner } from "ethers";

import reviewArtifact from "../../../contracts/artifacts/AgentReviewRegistry.json";

export type SixDimensionalRatings = [number, number, number, number, number, number];

export interface SubmitReviewInput {
  reviewRegistryAddress: string;
  signer: JsonRpcSigner;
  tokenId: bigint;
  ratings: SixDimensionalRatings;
  commentText: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<{ hash: string; commentHash: string }> {
  const commentHash = hashReviewComment(input.commentText);
  const contract = new Contract(
    input.reviewRegistryAddress,
    reviewArtifact.abi as InterfaceAbi,
    input.signer
  );
  const tx = await contract.submitReview(input.tokenId, input.ratings, commentHash);
  await tx.wait();
  return { hash: tx.hash as string, commentHash };
}

export function hashReviewComment(commentText: string): string {
  return sha256(toUtf8Bytes(commentText.trim()));
}
