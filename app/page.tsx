"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ethers } from "ethers";
import { ImageIcon, Loader2, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NFT_CONTRACT_ABI = [
  "function mint() public",
  "function totalMinted() public view returns (uint256)",
  "function maxSupply() public view returns (uint256)",
  "function mintOpen() public view returns (bool)",
  "function hasMinted(address) public view returns (bool)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function name() public view returns (string)",
  "function symbol() public view returns (string)",
];

const NFT_CONTRACT_ADDRESS = "0xc2caa430DbfC1A7c381D54D735Ed9c55fD4112A8";

const INTUITION_TESTNET = {
  chainId: "0x350B", // 13579 in hex
  chainName: "Intuition Testnet",
  nativeCurrency: {
    name: "tTRUST",
    symbol: "tTRUST",
    decimals: 18,
  },
  rpcUrls: ["https://testnet.rpc.intuition.systems/http"],
  blockExplorerUrls: ["https://testnet.explorer.intuition.systems"],
};

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
}

interface NFT {
  tokenId: number;
  metadata: NFTMetadata;
}

export default function NFTMintingPage() {
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [maxSupply, setMaxSupply] = useState<number>(0);
  const [mintPrice, setMintPrice] = useState<string>("0");
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string>("");
  const [showNetworkInstructions, setShowNetworkInstructions] = useState(false);
  const [userBalance, setUserBalance] = useState<string>("0");

  // Canvas animation ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle animation system - DEX Intuition style
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to full screen
    const resizeCanvas = () => {
      // Store current canvas state
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      
      // Fill with black immediately to prevent flash
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();

    // Constellation grid system - DEX Intuition style
    const points: Array<{
      x: number;
      y: number;
      originX: number;
      originY: number;
      vx: number;
      vy: number;
      opacity: number;
      targetOpacity: number;
      size: number;
      connections: number[];
    }> = [];

    let mouseX = 0;
    let mouseY = 0;

    // Create constellation grid with cluster distribution
    const createConstellationGrid = () => {
      const gridSize = 12; // 12x12 grid (further reduced density)
      const jitter = 40; // ±40px randomization (increased)

      for (let x = 0; x < window.innerWidth; x += window.innerWidth / gridSize) {
        for (let y = 0; y < window.innerHeight; y += window.innerHeight / gridSize) {
          // Create breathing zones - skip 30% of points randomly (increased)
          if (Math.random() < 0.3) continue;

          const jitterX = (Math.random() - 0.5) * jitter * 2;
          const jitterY = (Math.random() - 0.5) * jitter * 2;

          points.push({
            x: x + jitterX,
            y: y + jitterY,
            originX: x + jitterX,
            originY: y + jitterY,
            vx: (Math.random() - 0.5) * 0.8, // Constant velocity between -0.4 and +0.4
            vy: (Math.random() - 0.5) * 0.8, // Constant velocity between -0.4 and +0.4
            opacity: 0.6 + Math.random() * 0.4,
            targetOpacity: 0.6 + Math.random() * 0.4,
            size: 1.5 + Math.random() * 1,
            connections: [],
          });
        }
      }
    };


    createConstellationGrid();

    // Handle resize with particle repositioning
    const handleResize = () => {
      resizeCanvas();
      
      // Reposition existing particles to stay within bounds
      points.forEach(point => {
        if (point.x > window.innerWidth) point.x = window.innerWidth - 50;
        if (point.y > window.innerHeight) point.y = window.innerHeight - 50;
        if (point.x < 0) point.x = 50;
        if (point.y < 0) point.y = 50;
        
        // Adjust origin positions
        point.originX = Math.min(point.originX, window.innerWidth);
        point.originY = Math.min(point.originY, window.innerHeight);
      });
    };

    // Regenerate particles with adaptive density
    const regenerateParticles = () => {
      points.length = 0; // Clear existing particles
      
      // Recalculate particle count based on screen size (reduced density)
      const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 20000); // Reduced density
      const gridSize = Math.sqrt(particleCount);
      const jitter = 40;

      for (let x = 0; x < window.innerWidth; x += window.innerWidth / gridSize) {
        for (let y = 0; y < window.innerHeight; y += window.innerHeight / gridSize) {
          if (Math.random() < 0.2) continue; // Skip 20% randomly

          const jitterX = (Math.random() - 0.5) * jitter * 2;
          const jitterY = (Math.random() - 0.5) * jitter * 2;

          points.push({
            x: x + jitterX,
            y: y + jitterY,
            originX: x + jitterX,
            originY: y + jitterY,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            opacity: 0.6 + Math.random() * 0.4,
            targetOpacity: 0.6 + Math.random() * 0.4,
            size: 1.5 + Math.random() * 1,
            connections: [],
          });
        }
      }
    };

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        handleResize();
        regenerateParticles();
      }, 100);
    };

    window.addEventListener("resize", debouncedResize);

    // Mouse tracking for interaction
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    let animationFrameId: number;

    // Constellation animation loop
    const animate = () => {
      // Clear canvas with pure black background
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      const mouseAttraction = 200; // Attraction radius

      points.forEach((point, index) => {
        // Calculate mouse interaction
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const mouseDistance = Math.sqrt(dx * dx + dy * dy);

        let attractionX = 0;
        let attractionY = 0;

        // Mouse attraction within radius
        if (mouseDistance < mouseAttraction && mouseDistance > 0) {
          const attractionStrength = 1 - mouseDistance / mouseAttraction;
          attractionX = (dx / mouseDistance) * attractionStrength * 2;
          attractionY = (dy / mouseDistance) * attractionStrength * 2;
        }

        // Apply continuous movement with constant velocity
        point.x += point.vx;
        point.y += point.vy;

        // Add slight mouse attraction without disrupting continuous flow
        if (mouseDistance < mouseAttraction && mouseDistance > 0) {
          const attractionStrength = 1 - mouseDistance / mouseAttraction;
          point.vx += attractionX * attractionStrength * 0.002;
          point.vy += attractionY * attractionStrength * 0.002;
        }

        // Bounce physics on screen edges instead of wrapping
        if (point.x < 0 || point.x > window.innerWidth) {
          point.vx *= -1;
          point.x = Math.max(0, Math.min(window.innerWidth, point.x));
        }
        if (point.y < 0 || point.y > window.innerHeight) {
          point.vy *= -1;
          point.y = Math.max(0, Math.min(window.innerHeight, point.y));
        }

        // Draw point
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${point.opacity})`;
        ctx.fill();

      });

      // Draw dynamic connections with max 2 connections per point (reduced)
      const maxConnectionsPerPoint = 2;
      const maxDistance = 100; // Reduced distance
      const minOpacity = 0.1;
      const maxOpacity = 0.4; // Reduced max opacity

      points.forEach((particle, i) => {
        let connectionCount = 0;
        
        for (let j = i + 1; j < points.length; j++) {
          if (connectionCount >= maxConnectionsPerPoint) break;
          
          const otherParticle = points[j];
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            // Map distance to opacity
            const distanceRatio = distance / maxDistance;
            const lineOpacity = maxOpacity - distanceRatio * (maxOpacity - minOpacity);

            if (lineOpacity > minOpacity) {
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
              ctx.lineWidth = 1;
              ctx.stroke();
              connectionCount++;
            }
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", debouncedResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(resizeTimeout);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const connectWallet = async () => {
    console.log("[v0] Starting wallet connection process...");

    if (typeof window.ethereum === "undefined") {
      console.log("[v0] window.ethereum is undefined - no Web3 wallet detected");
      setNetworkError("Please install MetaMask or another Web3 wallet!");
      return;
    }

    console.log("[v0] Web3 wallet detected, proceeding with connection...");
    setIsConnecting(true);
    setNetworkError("");

    try {
      console.log("[v0] Requesting current chain ID...");
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      console.log("[v0] Current wallet chain ID:", chainId);
      console.log("[v0] Expected chain ID:", INTUITION_TESTNET.chainId);
      console.log("[v0] Chain ID match:", chainId === INTUITION_TESTNET.chainId);

      if (chainId !== INTUITION_TESTNET.chainId) {
        console.log("[v0] Chain ID mismatch - attempting to switch networks");
        try {
          console.log("[v0] Attempting wallet_switchEthereumChain...");
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: INTUITION_TESTNET.chainId }],
          });
          console.log("[v0] Successfully switched to Intuition testnet");
        } catch (switchError: any) {
          console.log("[v0] Switch error:", switchError);
          if (switchError.code === 4902) {
            console.log("[v0] Network not found, attempting to add it...");
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [INTUITION_TESTNET],
              });
              console.log("[v0] Successfully added Intuition testnet");
            } catch (addError) {
              console.error("[v0] Error adding network:", addError);
              setNetworkError("Failed to add Intuition testnet automatically.");
              setShowNetworkInstructions(true);
              return;
            }
          } else {
            console.error("[v0] Error switching network:", switchError);
            setNetworkError(
              `Network mismatch. Your wallet shows chain ID: ${chainId}, but we need: ${INTUITION_TESTNET.chainId}`,
            );
            setShowNetworkInstructions(true);
            return;
          }
        }
      }

      console.log("[v0] Creating ethers provider...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      console.log("[v0] Provider created, requesting accounts...");

      const accounts = await provider.send("eth_requestAccounts", []);
      console.log("[v0] Accounts received:", accounts);

      if (accounts.length > 0) {
        console.log("[v0] Setting up account and contract...");
        setAccount(accounts[0]);
        setProvider(provider);
        setNetworkError("");
        setShowNetworkInstructions(false);

        const signer = await provider.getSigner();
        const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, signer);
        setContract(contract);

        console.log("[v0] Loading contract data...");
        await loadContractData(contract);
        console.log("[v0] Loading user balance...");
        await loadUserBalance(provider, accounts[0]);
        console.log("[v0] Loading user NFTs...");
        await loadUserNFTs(contract, accounts[0]);
        console.log("[v0] Wallet connection complete!");
      } else {
        console.log("[v0] No accounts returned from wallet");
        setNetworkError("No accounts found. Please unlock your wallet.");
      }
    } catch (error) {
      console.error("[v0] Error connecting wallet:", error);
      setNetworkError(
        `Failed to connect wallet: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const loadContractData = async (contract: ethers.Contract) => {
    try {
      const [totalMinted, maxSupply] = await Promise.all([
        contract.totalMinted(),
        contract.maxSupply(),
      ]);

      setTotalSupply(Number(totalMinted));
      setMaxSupply(Number(maxSupply));
      setMintPrice("0"); // Always free mint
    } catch (error) {
      console.error("Error loading contract data:", error);
      setTotalSupply(0);
      setMaxSupply(1000);
      setMintPrice("0");
    }
  };

  const loadUserBalance = async (provider: ethers.BrowserProvider, userAddress: string) => {
    try {
      const balance = await provider.getBalance(userAddress);
      const balanceInEth = ethers.formatEther(balance);
      const formattedBalance = parseFloat(balanceInEth).toFixed(1);
      setUserBalance(formattedBalance);
    } catch (error) {
      console.error("Error loading user balance:", error);
      setUserBalance("0");
    }
  };

  const loadUserNFTs = async (contract: ethers.Contract, userAddress: string) => {
    setIsLoading(true);
    try {
      const balance = await contract.balanceOf(userAddress);
      const nfts: NFT[] = [];

      // This is a simplified approach - in production you'd want a better method
      const totalMinted = await contract.totalMinted();

      for (let tokenId = 1; tokenId <= Number(totalMinted); tokenId++) {
        try {
          const owner = await contract.ownerOf(tokenId);

          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            try {
              const tokenURI = await contract.tokenURI(tokenId);
              console.log("[v0] Token URI for", tokenId, ":", tokenURI);

              let metadata: NFTMetadata;

              if (tokenURI.startsWith("http")) {
                // Fetch metadata from HTTP/IPFS URL
                const response = await fetch(tokenURI);
                metadata = await response.json();
              } else {
                // Fallback for non-HTTP URIs
                metadata = {
                  name: `Genesis NFT #${tokenId}`,
                  description: `Intuition Network early builder badge #${tokenId}`,
                  image: `/placeholder.svg?height=300&width=300&query=Genesis%20NFT%20${tokenId}`,
                };
              }

              nfts.push({ tokenId: Number(tokenId), metadata });
            } catch (metadataError) {
              console.error("[v0] Error fetching metadata for token", tokenId, ":", metadataError);
              // Add NFT with basic info even if metadata fails
              nfts.push({
                tokenId: Number(tokenId),
                metadata: {
                  name: `Genesis NFT #${tokenId}`,
                  description: `Intuition Network early builder badge #${tokenId}`,
                  image: `/placeholder.svg?height=300&width=300&query=Genesis%20NFT%20${tokenId}`,
                },
              });
            }
          }
        } catch (ownerError) {
          // Token might not exist or other error, skip it
          continue;
        }
      }

      setUserNFTs(nfts);
    } catch (error) {
      console.error("[v0] Error loading user NFTs:", error);
      setUserNFTs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const mintNFT = async () => {
    if (!contract || !account) {
      setNetworkError("Wallet not connected properly");
      return;
    }

    setIsMinting(true);
    setNetworkError("");

    try {
      console.log("[v0] Starting mint process...");

      const hasMinted = await contract.hasMinted(account);
      if (hasMinted) {
        setNetworkError("You have already minted your NFT");
        return;
      }

      const mintOpen = await contract.mintOpen();
      if (!mintOpen) {
        setNetworkError("Minting is currently closed");
        return;
      }

      const tx = await contract.mint();

      console.log("[v0] Transaction sent:", tx.hash);
      console.log("[v0] Waiting for confirmation...");

      await tx.wait();
      console.log("[v0] Transaction confirmed!");

      await loadContractData(contract);
      await loadUserNFTs(contract, account);

      console.log("[v0] Mint completed successfully!");
    } catch (error: any) {
      console.error("[v0] Error minting NFT:", error);

      if (error.code === "INSUFFICIENT_FUNDS") {
        setNetworkError("Insufficient funds for transaction");
      } else if (error.code === "USER_REJECTED") {
        setNetworkError("Transaction cancelled by user");
      } else if (error.message?.includes("execution reverted")) {
        setNetworkError("Contract error: " + (error.reason || "Transaction failed"));
      } else {
        setNetworkError("Failed to mint NFT: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsMinting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount("");
    setProvider(null);
    setContract(null);
    setUserNFTs([]);
    setNetworkError("");
    setShowNetworkInstructions(false);
    setUserBalance("0");
  };

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Black background to prevent white flash */}
      <div className="fixed inset-0 bg-black z-0" />
      {/* Canvas animation background - matches DEX Intuition style */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ width: "100vw", height: "100vh", backgroundColor: 'black' }}
      />
      <header className="fixed top-0 left-0 right-0 z-20 h-16 sm:h-18 lg:h-20">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <h1 className="text-lg xs:text-xl font-bold text-white tracking-wide">
              GENESIS NFT
            </h1>

            {account ? (
              <div 
                onClick={disconnectWallet}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer transition-all rounded-xl hover:scale-105 bg-white/95 border border-black/10 text-gray-900 font-semibold text-xs sm:text-sm"
              >
                <span className="font-bold text-gray-900 hidden xs:inline">
                  {userBalance} tTRUST
                </span>
                <div 
                  className="flex items-center gap-1 sm:gap-2 pl-0 xs:pl-3 border-l-0 xs:border-l border-black/10"
                >
                  <div 
                    className="w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
                  />
                  <span className="text-gray-600 font-medium text-xs sm:text-sm">
                    {`${account.slice(0, 3)}...${account.slice(-3)}`}
                  </span>
                  <svg 
                    className="w-3 sm:w-4 h-3 sm:h-4" 
                    viewBox="0 0 20 20" 
                    fill="none" 
                    stroke="#6b7280" 
                    strokeWidth="2"
                  >
                    <path d="M5.25 7.5l4.25 4.25L13.75 7.5" />
                  </svg>
                </div>
              </div>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm bg-white/95 text-gray-900 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-lg font-semibold"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                <span>
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 min-h-screen pt-20 sm:pt-24 lg:pt-28 pb-8">
        <div className="space-y-8">
          <div className="text-center">
          <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-4 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent leading-tight">
            Hello Intuition Builder
          </h2>
          <p className="text-sm xs:text-base text-white/70 max-w-2xl mx-auto leading-relaxed">
            An early builder badge on the Intuition Network.
          </p>
        </div>

        {(networkError || showNetworkInstructions) && (
          <div className="max-w-2xl mx-auto mb-6 sm:mb-8">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Network Setup Required
                </CardTitle>
                <CardDescription className="text-red-300">{networkError}</CardDescription>
              </CardHeader>
              {showNetworkInstructions && (
                <CardContent className="space-y-3 sm:space-y-4 p-0">
                  <div className="text-sm text-gray-400 space-y-2">
                    <p className="font-semibold">To manually add Intuition Testnet:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>Open your wallet settings</li>
                      <li>Go to "Networks" or "Add Network"</li>
                      <li>Add a new network with these details:</li>
                    </ol>
                    <div className="bg-gray-900 p-3 rounded-md text-xs font-mono text-gray-300 space-y-1">
                      <div>
                        <strong>Network Name:</strong> Intuition Testnet
                      </div>
                      <div>
                        <strong>RPC URL:</strong> https://testnet.rpc.intuition.systems/http
                      </div>
                      <div>
                        <strong>Chain ID:</strong> 13579
                      </div>
                      <div>
                        <strong>Currency Symbol:</strong> tTRUST
                      </div>
                      <div>
                        <strong>Block Explorer:</strong> https://testnet.explorer.intuition.systems
                      </div>
                    </div>
                  </div>
                  <Button onClick={connectWallet} disabled={isConnecting} className="w-full">
                    {isConnecting ? "Connecting..." : "Try Again"}
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-5 lg:gap-6">
          <Card className="text-center p-3 xs:p-4 sm:p-5 lg:p-6 hover:bg-white/10 transition-all duration-300 min-h-[90px] xs:min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]" style={{background: '#1A1B1F', border: '1px solid rgba(255, 255, 255, 0.08)'}}>
            <CardHeader className="text-center p-0">
              <CardTitle className="text-xl xs:text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-2">
                {totalSupply}
              </CardTitle>
              <CardDescription className="text-white/60 text-xs sm:text-sm font-medium">Total Minted</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center p-3 xs:p-4 sm:p-5 lg:p-6 hover:bg-white/10 transition-all duration-300 min-h-[90px] xs:min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]" style={{background: '#1A1B1F', border: '1px solid rgba(255, 255, 255, 0.08)'}}>
            <CardHeader className="text-center p-0">
              <CardTitle className="text-xl xs:text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-2">
                {maxSupply}
              </CardTitle>
              <CardDescription className="text-white/60 text-xs sm:text-sm font-medium">Max Supply</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center p-3 xs:p-4 sm:p-5 lg:p-6 hover:bg-white/10 transition-all duration-300 min-h-[90px] xs:min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]" style={{background: '#1A1B1F', border: '1px solid rgba(255, 255, 255, 0.08)'}}>
            <CardHeader className="text-center p-0">
              <CardTitle className="text-xl xs:text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-2">
                {mintPrice === "0" ? "Free" : `${mintPrice} tTRUST`}
              </CardTitle>
              <CardDescription className="text-white/60 text-xs sm:text-sm font-medium">Mint Price</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="max-w-md mx-auto w-full">
          <Card className="p-5 xs:p-6 sm:p-8" style={{background: '#1A1B1F', border: '1px solid rgba(255, 255, 255, 0.08)'}}>
            <CardHeader className="text-center p-0 mb-4 sm:mb-6">
              <CardTitle className="text-xl sm:text-2xl font-bold text-white mb-3">Mint Your NFT</CardTitle>
              <CardDescription className="text-white/70 text-sm sm:text-base">
                {account ? "Ready to mint your unique NFT" : "Connect your wallet to get started"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {account && !networkError && !isMinting && (
                <div className="text-center text-sm text-emerald-400 bg-emerald-900/30 p-2 rounded-md">
                  ✓ Connected to Intuition Testnet
                </div>
              )}

              {account ? (
                <Button
                  onClick={mintNFT}
                  disabled={isMinting || totalSupply >= maxSupply || !!networkError}
                  className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:-translate-y-1 transition-all rounded-xl"
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Minting...
                    </>
                  ) : totalSupply >= maxSupply ? (
                    "Sold Out"
                  ) : (
                    `${mintPrice === "0" ? "Mint Free" : `Mint for ${mintPrice} tTRUST`}`
                  )}
                </Button>
              ) : (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold bg-white/95 text-gray-900 hover:bg-white hover:-translate-y-1 transition-all rounded-xl"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="h-5 w-5 mr-2" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {account && (
          <div className="mt-8">
            <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-white text-center mb-4 sm:mb-6 lg:mb-8">
              Your NFT Collection
            </h3>

            {isLoading ? (
              <div className="flex justify-center items-center py-6 sm:py-8 lg:py-12">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
                <span className="ml-2 text-xs sm:text-sm text-gray-400">
                  Loading your NFTs...
                </span>
              </div>
            ) : userNFTs.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 xs:gap-3 sm:gap-4 lg:gap-5">
                {userNFTs.map((nft) => (
                  <Card
                    key={nft.tokenId}
                    className="overflow-hidden hover:scale-[1.02] transition-transform duration-300 cursor-pointer group bg-gray-900 border-gray-700 relative z-10"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={nft.metadata.image || "/placeholder.svg"}
                        alt={nft.metadata.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <CardContent className="p-2 xs:p-3 sm:p-4">
                      <h4 className="font-serif font-bold text-xs xs:text-sm sm:text-base text-white mb-1 truncate">
                        {nft.metadata.name}
                      </h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mb-1 xs:mb-2 hidden xs:block">
                        {nft.metadata.description}
                      </p>
                      <Badge variant="outline" className="text-xs text-gray-400 border-gray-500 px-1 xs:px-2">
                        #{nft.tokenId}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 xs:py-8 sm:py-12 lg:py-16">
                <ImageIcon className="h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <h4 className="text-base xs:text-lg sm:text-xl font-serif font-bold text-white mb-2">
                  No NFTs Yet
                </h4>
                <p className="text-xs xs:text-sm sm:text-base text-gray-400 max-w-md mx-auto px-4">
                  Mint your first NFT to see it appear in your collection!
                </p>
              </div>
            )}
          </div>
        )}
        </div>

        <footer className="w-full text-center py-8 mt-12">
        <p className="text-xs sm:text-sm text-gray-400">
          Built with React, Ethers.js, and modern Web3 technologies
        </p>
        </footer>
      </main>
    </div>
  );
}
