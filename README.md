# REAL GAIN Reference Implementation

REAL GAIN (German Real Estate AI Initiative) is a network of companies in the real estate and facility management business aiming at offering a broad spectrum of tools to be used in Agentic AI systems to provide comprehensive data and functionality on management of buildings, land and structures.

# Roles

*REAL GAIN Agent Providers* offer their Agentic AI Tools providing access to data and business logic via MCP servers.

*REAL GAIN Solution Providers* add those tools flexibly to their solutions.

*The Real Insight GmbH* serves as a *REAL Gain Platform Providers* offering a vast set of tools themselves and providing a chatbot with orchestration of the selected tools to all solution providers.

# Metering and Billing

Agent Providers can define a named user-based billing plan for the use of their tools - if selected by a Solution Provider. The Real Insight will meter the usage, invoice the solution providers and pay the Agent Provider.

# Reference Implementation

This reference implementation gives Agent Providers the boilerplate in Typescript and Python to implemented a REAL GAIN-compliant [MCP server](https://mcp.com), which can easily be registered and offered to Solution Providers on The Real Insight.

# Multi-modal responses

In addition to standard MCP responses, REAL GAIN supports a specific set of resource types allowing for multi-modal responses from REAL GAIN Agent Tools:

* **Charts**
* **Maps**
* **Tables**

The data and configurations of such a resource have to be base64-encoded into the *blob* field of the MCP resource.

# Charts

A REAL GAIN chart configurationis an exact match to the JSON representation of an [APEX Chart](https://apexcharts.com) chart configuration

# Maps

# Tables

A JSON table specification contains a *data* and and options section

## Typescript Details

## Python Details


