export class ApiResponse {
  static success<T>(data: T, message?: string) {
    return {
      success: true,
      data,
      message
    };
  }

  static error(message: string, errors?: string[]) {
    return {
      success: false,
      message,
      errors: errors || []
    };
  }

  static paginated<T>(data: T[], total: number, page: number, totalPages: number, limit: number, message?: string) {
    return {
      success: true,
      data: {
        items: data,
        meta: {
          total,
          page,
          totalPages,
          limit
        }
      },
      message
    };
  }
}