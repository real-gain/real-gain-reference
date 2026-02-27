import express, { Request, Response, text } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolResult, GetPromptResult, isInitializeRequest, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import dayjs from 'dayjs';

// Create an MCP server with implementation details
const getServer = () => {
    const server = new McpServer({
        name: 'simple-streamable-http-server',
        version: '1.0.0',
    }, { capabilities: { logging: {} } });

    // Helper to fetch content from URI (file://, http(s)://, data:)
    const fetchFromUri = async (uri: string): Promise<{ buffer: Buffer; mimeType?: string }> => {
        if (uri.startsWith('file://')) {
            const filePath = fileURLToPath(uri);
            const buffer = await readFile(filePath);
            return { buffer };
        }
        if (uri.startsWith('data:')) {
            const match = uri.match(/^data:([^;]*);base64,(.+)$/);
            if (!match) throw new Error('Invalid data URI format');
            const mimeType = match[1] || undefined;
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            return { buffer, mimeType };
        }
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const res = await fetch(uri);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            const contentType = res.headers.get('content-type');
            const mimeType = contentType?.split(';')[0]?.trim();
            return { buffer: Buffer.from(arrayBuffer), mimeType };
        }
        throw new Error(`Unsupported URI scheme: ${uri.split(':')[0]}`);
    };

    // Helper to convert 2D array to markdown table
    const escapeCell = (s: string) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const toMarkdownTable = (rows: string[][]): string => {
        if (rows.length === 0) return '';
        const headers = rows[0];
        const headerRow = '| ' + headers.map(h => escapeCell(String(h ?? ''))).join(' | ') + ' |';
        const alignRow = '|' + headers.map(() => '---').join('|') + '|';
        const bodyRows = rows.slice(1).map(row => '| ' + row.map(c => escapeCell(String(c ?? ''))).join(' | ') + ' |');
        return [headerRow, alignRow, ...bodyRows].join('\n');
    };

    // Register a tool that sends multiple greetings with notifications
    server.tool(
        'co2measures',
        'Ein Werkzeug zur Ermittlung von technische Massnahmen, die die CO2-Emissionen in einem Gebäude zu reduzieren und helfen die Klimeziele für das Gebäude zu erreichen.',
        {
            area: z.number().describe('Fläche des Gebäudes in Quadratmetern'),
        },
        async ({ area }: { area: number }, { sendNotification }: { sendNotification: (notification: any) => Promise<void> }): Promise<CallToolResult> => {
            // Business logic for CO2 measures
            const calculateEmissions = (selectedMeasures: any) => {
                let startDate = new Date();
                let date = new Date(startDate);
                const endDate = new Date('1/1/2050');

                const startProperty = 33;
                const startGoal = 60;
                const b = 1000 * 60 * 60 * 24 * 30 * 100;
                let property;
                let goal;
                let stranded;

                const series = [];

                while (date.getTime() < endDate.getTime()) {
                    goal = startGoal * Math.exp(-(date.getTime() - startDate.getTime()) / b);
                    property = startProperty;

                    for (const measure of selectedMeasures) {
                        if (date.getTime() > dayjs(startDate).add(measure.projectDuration, 'month').toDate().getTime()) {
                            property -= (startProperty * measure.co2Reduction / 100);

                            property = Math.max(property, 0);
                        }
                    }

                    series.push({ time: date.getTime(), property, goal });

                    if (!stranded && property > goal) {
                        stranded = { time: date.getTime(), emission: property };
                    }

                    date = dayjs(date).add(1, 'month').toDate();
                }

                return { series, stranded };
            }

            const suggestedMeasures = [{
                measure: 'LED-Leuchten',
                synopsis: 'LED-Leuchten',
                investment: 43000,
                projectDuration: 8,
                energySavings: 11,
                co2Reduction: 4,
            }, {
                measure: 'Anbindung Fernwärme',
                synopsis: 'Anbindung Fernwärme',
                investment: 1000,
                projectDuration: 12,
                energySavings: 0,
                co2Reduction: 10,
            }, {
                measure: 'Energetische Sanierung der thermischen Hülle',
                synopsis: 'Energetische Sanierung',
                investment: 1234000,
                projectDuration: 36,
                energySavings: 128,
                co2Reduction: 28,
            }, {
                measure: 'Einbau Wärmepumpe',
                synopsis: 'Einbau Wärmepumpe',
                investment: 192000,
                energySavings: 81,
                projectDuration: 12,
                co2Reduction: 1,
            }, {
                measure: 'PV-Anlage',
                synopsis: 'PV-Anlage',
                investment: 150000,
                energySavings: 35,
                co2Reduction: 36,
                projectDuration: 24,
            }, {
                investment: 1576000,
                energySavings: 224,
                co2Reduction: 66,
            }];

            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            await sendNotification({
                method: "notifications/message",
                params: { level: "debug", type: "text", data: `Starting to simulate CO2 reduction measures.` }
            });

            await sleep(6000);

            await sendNotification({
                method: "notifications/message",
                params: { level: "info", type: "chart", data: `Completed simulation of CO2 reduction measures.` }
            });

            await sleep(6000);

            const calculations: any = calculateEmissions(suggestedMeasures);
            const chartResource = {
                type: 'chart',
                title: `CO2-Ziele und Maßnahmen`,
                chart: {
                    type: 'line',
                    height: 200,
                    series: [{
                        name: 'CO2-Emissionen',
                        data: calculations.series.map((entry: any) => entry.property)
                    }, {
                        name: 'CO2-Ziel',
                        data: calculations.series.map((entry: any) => entry.goal)
                    }],
                    options: {
                        dataLabels: {
                            enabled: false
                        },
                        colors: ['#649aaa', '#576071'],
                        stroke: {
                            width: [2, 2],
                        },
                        xaxis: {
                            type: 'datetime',
                            categories: calculations.series.map((entry: any) => entry.time)
                        },
                        yaxis: {
                            min: 0,
                            axisTicks: {
                                show: true,
                            },
                            axisBorder: {
                                show: true,
                                //color: '#00288E'
                            },
                            labels: {
                                style: {
                                    //colors: '#00288E',
                                },
                            },
                            title: {
                                text: 'kg CO₂',
                                style: {
                                    color: '#00288E',
                                }
                            }
                        },
                        tooltip: {
                            x: {
                                format: 'dd/MM/yy HH:mm'
                            },
                        },
                        annotations: {
                            xaxis: suggestedMeasures.map((measure: any) => {
                                return {
                                    // in a datetime series, the x value should be a timestamp, just like it is generated below
                                    x: dayjs(new Date()).add(measure.projectDuration, 'month').toDate().getTime(),
                                    strokeDashArray: 0,
                                    borderColor: "#775DD0",
                                    label: {
                                        borderColor: "#775DD0",
                                        style: {
                                            color: "#fff",
                                            background: "#775DD0"
                                        },
                                        text: measure.synopsis
                                    }
                                };
                            }),
                            points: calculations.stranded ?
                                [{
                                    x: calculations.stranded.time,
                                    y: calculations.stranded.emission,
                                    marker: {
                                        size: 8,
                                        borderColor: '#FF4560',
                                    },
                                    label: {
                                        //borderColor: '#FF4560',
                                        borderColor: null,
                                        textColor: '#FF4560',
                                        text: 'Stranded'
                                    }
                                }] : []
                        }
                    }
                }
            };

            return {
                content: [{
                    type: 'text',
                    text: `In einem Gebäude mit einer Fläche von ${area} Quadratmetern können die folgenden Maßnahmen zur CO2-Reduktion umgesetzt werden:\n\n
* ${Math.round(area * 0.05)} Bäume zu pflanzen\n
* ${Math.round(area * 0.02)} Photovoltaikanlagen zu installieren\n
* ${Math.round(area * 0.005)} Elektroautos zu kaufen\n`,
                }],
                structuredContent: {
                    __resources: [chartResource]
                }
            };
        }
    );

    server.tool(
        'realEstateOrganizations',
        'Ein Werkzeug zur Ermittlung von wichtigen Immobilien- und Facility Management-Organisationen in Deutschland.',
        {},
        async ({ }, { sendNotification }: { sendNotification: (notification: any) => Promise<void> }): Promise<CallToolResult> => {
            const organizations = [{
                name: 'Fraunhofer-Allianz BAU',
                address: 'Fraunhoferstr. 10, 83626 Valley',
                description: 'Rechtlich nicht selbstständige Einrichtung der Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.',
                email: 'info@zv.fraunhofer.de',
                website: 'www.fraunhofer.de',
                legalForm: '-',
                registrationNumber: '-',
                court: '-',
                taxNumber: '-',
                lat: 47.87571351167659,
                lon: 11.728079655193191,
                poiType: 'company',
                _type: 'LegalPerson'
            }, {
                name: 'gefma Deutscher Verband für Facility Management e.V.',
                address: 'Basteistraße 88 53173 Bonn',
                description: 'Deutscher Verband für Facility Management',
                email: 'info@gefma.de',
                website: 'www.gefma.de',
                legalForm: 'Eingetragener Verein',
                registrationNumber: 'Vereinsregister 7391',
                court: 'Bonn',
                taxNumber: 'DE192935291',
                lat: 50.737430,
                lon: 7.099620,
                poiType: 'company',
                _type: 'LegalPerson'
            }, {
                name: 'Smart Building Innovation gGmbH',
                address: 'Lietzenburger Str. 44/46, 10789 Berlin',
                description: 'SBIF ist eine Organisation, die sich für die Verbesserung der Immobilien- und Facility Management-Branche einsetzt.',
                email: 'communications@sbif.foundation',
                website: 'www.sbif.foundation',
                legalForm: 'Gemeinnützige Gesellschaft mit beschränkter Haftung',
                registrationNumber: 'HRB 241668 B',
                court: 'Charlottenburg',
                taxNumber: '27/640/03085',
                lat: 52.500724996124994,
                lon: 13.332664126582191,
                poiType: 'company',
                _type: 'LegalPerson'
            }, {
                name: 'ZIA Zentraler Immobilien Ausschuss e.V.',
                address: 'Leipziger Platz 9, 10117 Berlin',
                description: 'Der ZIA Zentraler Immobilien Ausschuss ist die ordnungs- und wirtschaftspolitische Interessenvertretung der gesamten Immobilienwirtschaft.',
                email: 'info@zia-deutschland.de',
                website: 'www.zia-deutschland.de',
                legalForm: 'Eingetragener Verein',
                registrationNumber: 'VR 25863 B',
                court: 'Amtsgericht Berlin-Charlottenburg',
                taxNumber: '-',
                lat: 52.50908192144996,
                lon: 13.37930986891092,
                poiType: 'company',
                _type: 'LegalPerson'
            }];
            const tableResource = {
                type: 'table',
                title: `Wichtige Immobilien- und Facility Management-Organisationen in Deutschland`,
                options: {
                    columns: [
                        {
                            name: "Name",
                            field: "name",
                            width: '250px'
                        }, {
                            name: 'Adresse',
                            field: "address",
                            width: '200px'
                        }, {
                            name: 'Beschreibung',
                            field: "description",
                            width: '300px'
                        }, {
                            name: 'E-Mail',
                            field: "email",
                            width: '200px'
                        }, {
                            name: 'Website',
                            field: "website",
                            width: '200px'
                        }, {
                            name: 'Rechtsform',
                            field: "legalForm",
                            width: '200px'
                        }, {
                            name: 'Handelsregister',
                            field: "registrationNumber",
                            width: '200px'
                        }, {
                            name: 'Registergericht',
                            field: "court",
                            width: '200px'
                        }, {
                            name: 'USt-IdNr.',
                            field: "taxNumber",
                            width: '200px'
                        }],
                },
                data: organizations,
            };
            const mapAndImageResource = {
                type: 'mapAndImage',
                title: `Wichtige Immobilien- und Facility Management-Organisationen in Deutschland`,
                options: {
                    entityType: 'PoI',
                    bounds: [[5.866667, 47.270111], [15.041667, 55.055556]],
                    zoom: 6,
                },
                data: organizations,
            };

            let markup = `Folgende Organisationen sind für die Immobilien- und Facility Management-Branche in Deutschland wichtig:\n\n`;

            for (const organization of organizations) {
                markup += `* ${organization.name}\n`;
            }

            markup += `\n\n`;

            return {
                content: [{
                    type: 'text',
                    text: markup,
                }],
                structuredContent: {
                    __resources: [tableResource, mapAndImageResource]
                }
            };
        }
    );

    server.tool(
        'process_file',
        'Liest eine Datei von einer URI und wandelt sie je nach MIME-Typ in Markdown um (Tabelle für CSV/Excel, Text für Textdateien).',
        {
            resource: z.object({
                uri: z.string().describe('URI der Ressource (file://, http(s):// oder data:)'),
                mimeType: z.string().optional().describe('MIME-Typ der Datei'),
                name: z.string().optional().describe('Name der Datei'),
                size: z.number().optional().describe('Größe in Bytes'),
            }),
        },
        async ({ resource }: { resource: { uri: string; mimeType?: string; name?: string; size?: number } }): Promise<CallToolResult> => {
            const csvMimeTypes = ['text/csv', 'application/csv', 'text/x-csv'];
            const excelMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'application/vnd.oasis.opendocument.spreadsheet',
            ];
            const textMimeTypes = ['text/plain', 'text/html', 'text/xml', 'application/json'];

            const isCsv = (m: string) => csvMimeTypes.includes(m) || m?.startsWith('text/csv');
            const isExcel = (m: string) => excelMimeTypes.includes(m);
            const isText = (m: string) => textMimeTypes.includes(m) || m?.startsWith('text/');

            try {
                const { buffer, mimeType: fetchedMimeType } = await fetchFromUri(resource.uri);
                let mimeType = (resource.mimeType || fetchedMimeType || '').toLowerCase().split(';')[0].trim();
                if (!mimeType && resource.uri) {
                    const ext = resource.uri.split(/[#?]/)[0].split('.').pop()?.toLowerCase();
                    const extMap: Record<string, string> = {
                        csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        xls: 'application/vnd.ms-excel', txt: 'text/plain', json: 'application/json',
                    };
                    mimeType = extMap[ext || ''] || '';
                }

                if (isCsv(mimeType)) {
                    const rows = parseCsv(buffer, { relax_quotes: true, relax_column_count: true });
                    const rowsStr = rows.map((row: string[] | Record<string, unknown>) =>
                        Array.isArray(row) ? row : Object.values(row)
                    ) as string[][];
                    const table = toMarkdownTable(rowsStr);
                    return { content: [{ type: 'text', text: table }] };
                }

                if (isExcel(mimeType)) {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
                    const table = toMarkdownTable(rows);
                    return { content: [{ type: 'text', text: table }] };
                }

                if (isText(mimeType)) {
                    const text = buffer.toString('utf-8');
                    return { content: [{ type: 'text', text }] };
                }

                return {
                    content: [{ type: 'text', text: 'nicht unterstützter MIME-Typ' }],
                    isError: true,
                };
            } catch (err) {
                return {
                    content: [{
                        type: 'text',
                        text: err instanceof Error ? err.message : String(err),
                    }],
                    isError: true,
                };
            }
        }
    );

    return server;
};

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'last-event-id']
}));

// Serve static files from the doc directory
app.use('/doc', express.static('doc'));

app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP endpoint
app.post('/mcp', async (req: Request, res: Response) => {
    console.log('Received MCP request:', req.body);
    try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        console.log('Session ID:', sessionId);

        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            console.log('Reusing existing transport');
            // Reuse existing transport
            transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            console.log('New initialization request');
            // New initialization request
            const eventStore = new InMemoryEventStore();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                eventStore, // Enable resumability
                enableJsonResponse: true, // Enable JSON response mode
                onsessioninitialized: (sessionId) => {
                    // Store the transport by session ID when session is initialized
                    // This avoids race conditions where requests might come in before the session is stored
                    console.log(`Session initialized with ID: ${sessionId}`);
                    transports[sessionId] = transport;
                }
            });

            // Set up onclose handler to clean up transport when closed
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    console.log(`Transport closed for session ${sid}, removing from transports map`);
                    delete transports[sid];
                }
            };

            // Connect the transport to the MCP server BEFORE handling the request
            // so responses can flow back through the same transport
            const server = getServer();
            await server.connect(transport);

            console.log('Handling request with server');

            await transport.handleRequest(req, res, req.body);
            return; // Already handled
        } else {
            // Invalid request - no session ID or not initialization request
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });
            return;
        }

        // Handle the request with existing transport - no need to reconnect
        // The existing transport is already connected to the server
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }
});

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
app.get('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination (according to MCP spec)
app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    console.log(`Received session termination request for session ${sessionId}`);

    try {
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error('Error handling session termination:', error);
        if (!res.headersSent) {
            res.status(500).send('Error processing session termination');
        }
    }
});

// Start the server
const PORT = 3066;
app.listen(PORT, () => {
    console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');

    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
        try {
            console.log(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
        } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
    console.log('Server shutdown complete');
    process.exit(0);
});