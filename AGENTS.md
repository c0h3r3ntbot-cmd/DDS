# Bridge Double Dummy Solver - Cursor Agent Guide

This document outlines the step-by-step architecture and prompts for building an interactive Bridge Double Dummy Solver. The application uses a Python/FastAPI backend (leveraging the `endplay` library for Bo Haglund's DDS) and a React/Next.js frontend.

Please complete these steps in order. Do not proceed to the next step until the current one is fully functional.

## Step 1: Set up the Backend Engine

**Goal:** Create a Python API that calculates trick counts for legal cards using the `endplay` library.

**Prerequisites:** 
- Ensure a Python environment is active.
- Run: `pip install fastapi uvicorn endplay pydantic`

**Instructions for Cursor:**
> Create a FastAPI backend for a bridge application. I want to use the `endplay` Python library (which natively uses Bo Haglund's DDS). Create a main `main.py` file with an endpoint `/api/evaluate` that accepts a JSON payload containing: 
> 1. The current hands (as a PBN string or lists of cards)
> 2. The trump suit
> 3. The declarer
> 4. The sequence of cards played so far in the current trick. 
> 
> The endpoint should use `endplay.dds.solve_board` (or the equivalent `endplay` function for analyzing play) to return a dictionary mapping every legal card the next player can play to the number of tricks their side can make.

## Step 2: Build the Frontend State & Logic

**Goal:** Create the core state management for the Bridge game on the frontend.

**Instructions for Cursor:**
> I am building a React/Next.js frontend for a bridge game. Create a custom hook `useBridgeGame` that manages the game state. It needs to track: 
> - The initial PBN deal
> - The trump suit
> - The declarer
> - The current player on turn
> - The cards remaining in all four hands (North, South, East, West)
> - The cards played in the current trick. 
> 
> Include a function `playCard(suit, rank)` that moves a card from a hand to the current trick, updates who is on turn, and automatically clears the trick after 4 cards are played. Also, include a `useEffect` that calls the FastAPI `/api/evaluate` endpoint every time the turn changes, and stores the resulting 'tricks available' data in a state variable.

## Step 3: Build the Visual Interface

**Goal:** Create the visual Bridge table and overlay the double-dummy trick evaluation on the cards.

**Instructions for Cursor:**
> Using Tailwind CSS and the `useBridgeGame` hook we just made, create the visual bridge table component. It should have a green felt background. Arrange the four hands in a cross pattern (North at top, South at bottom, East right, West left). In the center, display the cards played in the current trick. 
> 
> For the player whose turn it is, look at the 'tricks available' data fetched from the backend. Overlay a small, stylish badge on each of their legal cards showing this number (e.g., '9' in a green badge if it makes the contract, '8' in a red badge if it drops a trick). Non-legal cards (if the player must follow suit) should be grayed out and unclickable.

## Step 4: Add PBN Upload Functionality

**Goal:** Allow users to upload and parse standard `.pbn` files to initialize the game.

**Instructions for Cursor:**
> Add a file upload component to the React app that accepts `.pbn` files. When a user uploads a file, read the text content and parse out the 'Deal', 'Declarer', and 'Trump' tags. Pass this parsed data into the `useBridgeGame` hook to initialize the board state so the user can immediately start playing the hand double-dummy.