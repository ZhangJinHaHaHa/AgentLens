pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/*
 * AuditScoreVerifier — ZK proof that dimensional scores were correctly
 * computed from raw evaluation data (Groth16 / BN128).
 *
 * Public:  dimensionalScores[6], overallScore, inputCommitment
 * Private: categoryScores[6][10], categoryCounts[6], cpuAvgMilli,
 *          memoryPeakMb, complianceScore, securityBoundaryScore
 */

template SafeAverage(n) {
    signal input values[n];
    signal input count;
    signal output avg;

    signal sums[n + 1];
    sums[0] <== 0;
    for (var i = 0; i < n; i++) {
        sums[i + 1] <== sums[i] + values[i];
    }

    component isZero = IsZero();
    isZero.in <== count;

    signal quotient;
    signal remainder;
    quotient <-- isZero.out == 1 ? 0 : sums[n] \ count;
    remainder <-- isZero.out == 1 ? 0 : sums[n] % count;

    signal qTimesCount;
    qTimesCount <== quotient * count;
    signal expected;
    expected <== qTimesCount + remainder;

    signal diff;
    diff <== sums[n] - expected;
    signal constrainedDiff;
    constrainedDiff <== diff * (1 - isZero.out);
    constrainedDiff === 0;

    component ltCheck = LessThan(16);
    ltCheck.in[0] <== remainder;
    ltCheck.in[1] <== count + isZero.out;
    ltCheck.out === 1;

    avg <== quotient;
}

template ResourceScore() {
    signal input cpuAvgMilli;
    signal input memoryPeakMb;
    signal output score;

    component cpuLow = LessEqThan(32);
    cpuLow.in[0] <== cpuAvgMilli;
    cpuLow.in[1] <== 500;

    component cpuMid = LessEqThan(32);
    cpuMid.in[0] <== cpuAvgMilli;
    cpuMid.in[1] <== 2000;

    signal notLow;
    notLow <== 1 - cpuLow.out;
    signal notMid;
    notMid <== 1 - cpuMid.out;

    signal lowTerm;
    lowTerm <== cpuLow.out * 100;

    signal notLowTimesMid;
    notLowTimesMid <== notLow * cpuMid.out;
    signal midTerm;
    midTerm <== notLowTimesMid * 80;

    signal notLowTimesNotMid;
    notLowTimesNotMid <== notLow * notMid;
    signal highTerm;
    highTerm <== notLowTimesNotMid * 30;

    signal cpuScore;
    cpuScore <== lowTerm + midTerm + highTerm;

    component memLow = LessEqThan(32);
    memLow.in[0] <== memoryPeakMb;
    memLow.in[1] <== 256;

    component memMid = LessEqThan(32);
    memMid.in[0] <== memoryPeakMb;
    memMid.in[1] <== 1024;

    signal memNotLow;
    memNotLow <== 1 - memLow.out;
    signal memNotMid;
    memNotMid <== 1 - memMid.out;

    signal memLowTerm;
    memLowTerm <== memLow.out * 100;

    signal memNotLowTimesMid;
    memNotLowTimesMid <== memNotLow * memMid.out;
    signal memMidTerm;
    memMidTerm <== memNotLowTimesMid * 80;

    signal memNotLowTimesNotMid;
    memNotLowTimesNotMid <== memNotLow * memNotMid;
    signal memHighTerm;
    memHighTerm <== memNotLowTimesNotMid * 30;

    signal memScore;
    memScore <== memLowTerm + memMidTerm + memHighTerm;

    score <-- (cpuScore + memScore) \ 2;

    signal doubleScore;
    doubleScore <== score * 2;
    signal sumScores;
    sumScores <== cpuScore + memScore;
    signal divRemainder;
    divRemainder <== sumScores - doubleScore;
    component remCheck = LessThan(8);
    remCheck.in[0] <== divRemainder;
    remCheck.in[1] <== 2;
    remCheck.out === 1;
}

template RangeCheck100() {
    signal input value;
    component lte = LessEqThan(8);
    lte.in[0] <== value;
    lte.in[1] <== 100;
    lte.out === 1;
}

template AuditScoreVerifier() {
    signal input dimensionalScores[6];
    signal input overallScore;
    signal input inputCommitment;

    signal input categoryScores[6][10];
    signal input categoryCounts[6];
    signal input cpuAvgMilli;
    signal input memoryPeakMb;
    signal input complianceScore;
    signal input securityBoundaryScore;

    // Step 1: Input commitment
    component commitHash = Poseidon(8);
    commitHash.inputs[0] <== categoryCounts[0];
    commitHash.inputs[1] <== categoryCounts[1];
    commitHash.inputs[2] <== categoryCounts[2];
    commitHash.inputs[3] <== categoryCounts[3];
    commitHash.inputs[4] <== cpuAvgMilli;
    commitHash.inputs[5] <== memoryPeakMb;
    commitHash.inputs[6] <== complianceScore;
    commitHash.inputs[7] <== securityBoundaryScore;
    commitHash.out === inputCommitment;

    // Step 2: Dimensional score verification

    // Dim 0: Security
    component secAvg = SafeAverage(10);
    for (var i = 0; i < 10; i++) { secAvg.values[i] <== categoryScores[0][i]; }
    secAvg.count <== categoryCounts[0];

    component secHasQ = IsZero();
    secHasQ.in <== categoryCounts[0];
    signal secCombined;
    secCombined <-- secHasQ.out == 1 ? securityBoundaryScore : (secAvg.avg + securityBoundaryScore) \ 2;
    dimensionalScores[0] === secCombined;

    // Dim 1: Task Execution
    component taskAvg = SafeAverage(10);
    for (var i = 0; i < 10; i++) { taskAvg.values[i] <== categoryScores[1][i]; }
    taskAvg.count <== categoryCounts[1];
    dimensionalScores[1] === taskAvg.avg;

    // Dim 2: Cognitive
    component cogAvg = SafeAverage(10);
    for (var i = 0; i < 10; i++) { cogAvg.values[i] <== categoryScores[2][i]; }
    cogAvg.count <== categoryCounts[2];
    dimensionalScores[2] === cogAvg.avg;

    // Dim 3: Environment
    component envAvg = SafeAverage(10);
    for (var i = 0; i < 10; i++) { envAvg.values[i] <== categoryScores[3][i]; }
    envAvg.count <== categoryCounts[3];
    dimensionalScores[3] === envAvg.avg;

    // Dim 4: Engineering
    component resScore = ResourceScore();
    resScore.cpuAvgMilli <== cpuAvgMilli;
    resScore.memoryPeakMb <== memoryPeakMb;
    dimensionalScores[4] === resScore.score;

    // Dim 5: Compliance
    dimensionalScores[5] === complianceScore;

    // Step 3: Overall weighted average
    signal w0; w0 <== dimensionalScores[0] * 2500;
    signal w1; w1 <== dimensionalScores[1] * 2000;
    signal w2; w2 <== dimensionalScores[2] * 1500;
    signal w3; w3 <== dimensionalScores[3] * 1500;
    signal w4; w4 <== dimensionalScores[4] * 1500;
    signal w5; w5 <== dimensionalScores[5] * 1000;
    signal weightedSum;
    weightedSum <== w0 + w1 + w2 + w3 + w4 + w5;

    signal computedOverall;
    computedOverall <-- weightedSum \ 10000;

    signal lowerBound;
    lowerBound <== computedOverall * 10000;
    signal upperBound;
    upperBound <== lowerBound + 10000;

    component overallGte = GreaterEqThan(32);
    overallGte.in[0] <== weightedSum;
    overallGte.in[1] <== lowerBound;
    overallGte.out === 1;

    component overallLt = LessThan(32);
    overallLt.in[0] <== weightedSum;
    overallLt.in[1] <== upperBound;
    overallLt.out === 1;

    overallScore === computedOverall;

    // Step 4: Range checks
    component rangeChecks[7];
    for (var i = 0; i < 6; i++) {
        rangeChecks[i] = RangeCheck100();
        rangeChecks[i].value <== dimensionalScores[i];
    }
    rangeChecks[6] = RangeCheck100();
    rangeChecks[6].value <== overallScore;
}

component main {public [dimensionalScores, overallScore, inputCommitment]} = AuditScoreVerifier();
