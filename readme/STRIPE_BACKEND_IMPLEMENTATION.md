# Stripe Backend API Implementation

This document provides sample implementations for the backend API endpoints required for the Stripe marketplace payment integration.

## Prerequisites

1. **Stripe Account Setup**
   - Create a Stripe account and get your API keys
   - Enable marketplace functionality
   - Set up webhook endpoints

2. **Dependencies**
   ```bash
   npm install stripe express cors helmet
   # or
   yarn add stripe express cors helmet
   ```

3. **Environment Variables**
   ```env
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   DATABASE_URL=your_database_connection_string
   ```

## Express.js Implementation

### 1. Server Setup

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Authentication middleware (implement according to your auth system)
const authenticateCustomer = async (req, res, next) => {
  try {
    // Your authentication logic here
    // Example: verify JWT token, session, etc.
    const customerId = req.headers['x-customer-id'] || req.params.customerId;
    
    if (!customerId) {
      return res.status(401).json({ error: 'Customer ID required' });
    }
    
    req.customerId = customerId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Routes
app.use('/api/customers/:customerId/payment-methods', authenticateCustomer);
```

### 2. GET /api/customers/{customerId}/payment-methods

```javascript
// GET /api/customers/:customerId/payment-methods
app.get('/api/customers/:customerId/payment-methods', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get customer's Stripe customer ID from your database
    const customer = await getCustomerFromDatabase(customerId);
    if (!customer.stripeCustomerId) {
      return res.json({
        paymentMethods: [],
        defaultPaymentMethod: null
      });
    }
    
    // Retrieve payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripeCustomerId,
      type: 'card',
    });
    
    // Get default payment method
    const stripeCustomer = await stripe.customers.retrieve(customer.stripeCustomerId);
    
    res.json({
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        } : null,
        billing_details: pm.billing_details,
        created: pm.created
      })),
      defaultPaymentMethod: stripeCustomer.invoice_settings.default_payment_method
    });
    
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payment methods',
      details: error.message 
    });
  }
});
```

### 3. POST /api/customers/{customerId}/payment-methods

```javascript
// POST /api/customers/:customerId/payment-methods
app.post('/api/customers/:customerId/payment-methods', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }
    
    // Get customer's Stripe customer ID from your database
    const customer = await getCustomerFromDatabase(customerId);
    
    // Create Stripe customer if it doesn't exist
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: customer.name,
        metadata: {
          customerId: customerId
        }
      });
      
      stripeCustomerId = stripeCustomer.id;
      
      // Update your database with the Stripe customer ID
      await updateCustomerStripeId(customerId, stripeCustomerId);
    }
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
    
    // Retrieve the attached payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    // Set as default if it's the first payment method
    const existingPaymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });
    
    if (existingPaymentMethods.data.length === 1) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    res.json({
      id: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.card ? {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
      } : null,
      billing_details: paymentMethod.billing_details,
      created: paymentMethod.created
    });
    
  } catch (error) {
    console.error('Error adding payment method:', error);
    
    if (error.code === 'resource_missing') {
      return res.status(400).json({ error: 'Invalid payment method ID' });
    }
    
    res.status(500).json({ 
      error: 'Failed to add payment method',
      details: error.message 
    });
  }
});
```

### 4. DELETE /api/customers/{customerId}/payment-methods/{paymentMethodId}

```javascript
// DELETE /api/customers/:customerId/payment-methods/:paymentMethodId
app.delete('/api/customers/:customerId/payment-methods/:paymentMethodId', async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.params;
    
    // Get customer's Stripe customer ID from your database
    const customer = await getCustomerFromDatabase(customerId);
    if (!customer.stripeCustomerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Check if this is the default payment method
    const stripeCustomer = await stripe.customers.retrieve(customer.stripeCustomerId);
    const isDefault = stripeCustomer.invoice_settings.default_payment_method === paymentMethodId;
    
    // Detach payment method from customer
    await stripe.paymentMethods.detach(paymentMethodId);
    
    // If it was the default, clear the default payment method
    if (isDefault) {
      await stripe.customers.update(customer.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: null,
        },
      });
    }
    
    res.json({ 
      success: true,
      message: 'Payment method removed successfully' 
    });
    
  } catch (error) {
    console.error('Error removing payment method:', error);
    
    if (error.code === 'resource_missing') {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to remove payment method',
      details: error.message 
    });
  }
});
```

### 5. POST /api/customers/{customerId}/payment-methods/default

```javascript
// POST /api/customers/:customerId/payment-methods/default
app.post('/api/customers/:customerId/payment-methods/default', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }
    
    // Get customer's Stripe customer ID from your database
    const customer = await getCustomerFromDatabase(customerId);
    if (!customer.stripeCustomerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Verify the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== customer.stripeCustomerId) {
      return res.status(403).json({ error: 'Payment method does not belong to this customer' });
    }
    
    // Set as default payment method
    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    res.json({ 
      success: true,
      message: 'Default payment method updated successfully' 
    });
    
  } catch (error) {
    console.error('Error setting default payment method:', error);
    
    if (error.code === 'resource_missing') {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to set default payment method',
      details: error.message 
    });
  }
});
```

## Database Helper Functions

```javascript
// database.js
const { Pool } = require('pg'); // or your preferred database

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getCustomerFromDatabase(customerId) {
  const query = 'SELECT * FROM customers WHERE id = $1';
  const result = await pool.query(query, [customerId]);
  return result.rows[0];
}

async function updateCustomerStripeId(customerId, stripeCustomerId) {
  const query = 'UPDATE customers SET stripe_customer_id = $1 WHERE id = $2';
  await pool.query(query, [stripeCustomerId, customerId]);
}

async function createPaymentTransaction(customerId, paymentMethodId, amount, description) {
  const query = `
    INSERT INTO payment_transactions (customer_id, payment_method_id, amount, description, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await pool.query(query, [customerId, paymentMethodId, amount, description, 'pending']);
  return result.rows[0];
}
```

## Node.js/TypeScript Implementation

```typescript
// types.ts
interface Customer {
  id: string;
  email: string;
  name: string;
  stripeCustomerId?: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details?: {
    name: string;
    email: string;
  };
  created: number;
}

// paymentMethodsController.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class PaymentMethodsController {
  static async getPaymentMethods(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      
      const customer = await getCustomerFromDatabase(customerId);
      if (!customer?.stripeCustomerId) {
        return res.json({
          paymentMethods: [],
          defaultPaymentMethod: null
        });
      }
      
      const [paymentMethods, stripeCustomer] = await Promise.all([
        stripe.paymentMethods.list({
          customer: customer.stripeCustomerId,
          type: 'card',
        }),
        stripe.customers.retrieve(customer.stripeCustomerId)
      ]);
      
      res.json({
        paymentMethods: paymentMethods.data.map(this.mapPaymentMethod),
        defaultPaymentMethod: stripeCustomer.invoice_settings.default_payment_method
      });
      
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(500).json({ 
        error: 'Failed to fetch payment methods',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  private static mapPaymentMethod(pm: Stripe.PaymentMethod): PaymentMethod {
    return {
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      } : undefined,
      billing_details: pm.billing_details || undefined,
      created: pm.created
    };
  }
}
```

## Error Handling and Validation

```javascript
// middleware/validation.js
const { body, param, validationResult } = require('express-validator');

const validatePaymentMethodId = [
  body('paymentMethodId')
    .isString()
    .notEmpty()
    .withMessage('Payment method ID is required'),
];

const validateCustomerId = [
  param('customerId')
    .isString()
    .notEmpty()
    .withMessage('Customer ID is required'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

// Apply to routes
app.post('/api/customers/:customerId/payment-methods', 
  validateCustomerId, 
  validatePaymentMethodId, 
  handleValidationErrors,
  paymentMethodsController.addPaymentMethod
);
```

## Webhook Handler for Payment Events

```javascript
// webhooks.js
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_method.attached':
      console.log('Payment method attached:', event.data.object);
      break;
      
    case 'payment_method.detached':
      console.log('Payment method detached:', event.data.object);
      break;
      
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object);
      break;
      
    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});
```

## Testing the Endpoints

```bash
# Test GET endpoint
curl -X GET http://localhost:3001/api/customers/cust_123/payment-methods \
  -H "Content-Type: application/json" \
  -H "x-customer-id: cust_123"

# Test POST endpoint (add payment method)
curl -X POST http://localhost:3001/api/customers/cust_123/payment-methods \
  -H "Content-Type: application/json" \
  -H "x-customer-id: cust_123" \
  -d '{"paymentMethodId": "pm_1234567890"}'

# Test DELETE endpoint
curl -X DELETE http://localhost:3001/api/customers/cust_123/payment-methods/pm_1234567890 \
  -H "Content-Type: application/json" \
  -H "x-customer-id: cust_123"

# Test POST default endpoint
curl -X POST http://localhost:3001/api/customers/cust_123/payment-methods/default \
  -H "Content-Type: application/json" \
  -H "x-customer-id: cust_123" \
  -d '{"paymentMethodId": "pm_1234567890"}'
```

## Security Considerations

1. **Authentication**: Implement proper authentication for all endpoints
2. **Authorization**: Ensure customers can only access their own payment methods
3. **Input Validation**: Validate all input parameters
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **HTTPS**: Use HTTPS in production
6. **Webhook Verification**: Always verify webhook signatures
7. **Error Handling**: Don't expose sensitive information in error messages

## Database Schema Example

```sql
-- customers table
CREATE TABLE customers (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- payment_transactions table
CREATE TABLE payment_transactions (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) REFERENCES customers(id),
  payment_method_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_customers_stripe_id ON customers(stripe_customer_id);
CREATE INDEX idx_transactions_customer_id ON payment_transactions(customer_id);
CREATE INDEX idx_transactions_status ON payment_transactions(status);
```

This implementation provides a complete foundation for handling Stripe payment methods in your marketplace application. Adapt the code to your specific backend framework and database system. 