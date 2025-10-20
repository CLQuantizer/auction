# API Documentation

This document provides details on the available API endpoints for the auction service.

## Orders API

The Orders API allows you to manage orders in the order book.

### Get all orders

- **Endpoint:** `GET /orders`
- **Method:** `GET`
- **Description:** Retrieves a list of all current orders in the order book.
- **Request Body:** None
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** An array of order objects.
    ```json
    [
        {
            "orderId": "string",
            "userId": "string",
            "side": "buy" | "sell",
            "price": "string",
            "quantity": "string",
            "createdAt": "date"
        }
    ]
    ```

### Place an order

- **Endpoint:** `POST /v1/orders/place`
- **Method:** `POST`
- **Description:** Places a new order in the order book.
- **Request Body:**
  ```json
  {
      "userId": "string",
      "side": "buy" | "sell",
      "price": "string" | "number",
      "quantity": "string" | "number"
  }
  ```
- **Success Response:**
  - **Code:** 201 Created
  - **Content:** The created order object.
    ```json
    {
        "orderId": "string",
        "userId": "string",
        "side": "buy" | "sell",
        "price": "string",
        "quantity": "string",
        "createdAt": "date"
    }
    ```
- **Error Responses:**
  - **Code:** 400 Bad Request - If JSON is invalid, fields are missing, side is invalid, or balance is insufficient.
  - **Code:** 500 Internal Server Error - If the order fails to be placed.

### Cancel an order

- **Endpoint:** `POST /v1/orders/cancel`
- **Method:** `POST`
- **Description:** Cancels an existing order.
- **Request Body:**
  ```json
  {
      "orderId": "string",
      "userId": "string"
  }
  ```
- **Success Response:**
  - **Code:** 200 OK
  - **Content:**
    ```json
    {
        "success": true,
        "orderId": "string"
    }
    ```
- **Error Responses:**
  - **Code:** 400 Bad Request - If JSON is invalid or fields are missing.
  - **Code:** 404 Not Found - If the order is not found or the user does not have permission to cancel it.

## Withdraw API

The Withdraw API allows you to withdraw funds.

### Withdraw funds

- **Endpoint:** `POST /withdraw`
- **Method:** `POST`
- **Description:** Initiates a withdrawal of funds for a user.
- **Request Body:**
  ```json
  {
      "userId": "string",
      "amount": "string" | "number",
      "toAddress": "string"
  }
  ```
- **Success Response:**
  - **Code:** 201 Created
  - **Content:**
    ```json
    {
        "success": true,
        "withdrawal": {
            "from": "string",
            "to": "string",
            "value": "string",
            "status": "pending",
            "blockNumber": null,
            "hash": null,
            "id": "number"
        }
    }
    ```
- **Error Responses:**
    - **Code:** 400 Bad Request - If JSON is invalid, fields are missing, withdrawal amount is invalid, or user has insufficient balance.
    - **Code:** 500 Internal Server Error - If the withdrawal service is not configured or fails to process.
